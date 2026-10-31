import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { RequisicaoRow, RequisicaoStatus, RequisicaoTipo, RequisicaoUrgencia } from '../../types/database'

export const REQUISICOES_KEY = ['requisicoes']

// A RLS (migration 0048) já filtra: o dono vê as suas, o Gestor as do setor,
// o Administrador todas — o client só pede tudo que vier.
export function useRequisicoes() {
  return useQuery({
    queryKey: REQUISICOES_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('requisicoes').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return data as RequisicaoRow[]
    },
  })
}

export function useRequisicoesRealtime() {
  const queryClient = useQueryClient()
  useEffect(() => {
    const channel = supabase
      .channel('requisicoes:all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requisicoes' }, () => {
        queryClient.invalidateQueries({ queryKey: REQUISICOES_KEY })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}

export interface RequisicaoInput {
  tipo: RequisicaoTipo
  titulo: string
  descricao: string | null
  urgencia: RequisicaoUrgencia
  fotoPath: string | null
}

// solicitante, setor e status são fixados pelo trigger do banco — aqui só vai
// o que a pessoa preenche.
export async function criarRequisicao(input: RequisicaoInput): Promise<void> {
  const { error } = await supabase.from('requisicoes').insert({
    tipo: input.tipo,
    titulo: input.titulo.trim(),
    descricao: input.descricao,
    urgencia: input.urgencia,
    foto_path: input.fotoPath,
  })
  if (error) throw error
}

// A RLS só deixa o dono editar enquanto pendente: se mudou nesse meio tempo
// (o Administrador decidiu), o update afeta 0 linhas sem erro — o .select()
// confirma que gravou.
export async function atualizarRequisicao(id: string, input: RequisicaoInput): Promise<void> {
  const { data, error } = await supabase
    .from('requisicoes')
    .update({
      tipo: input.tipo,
      titulo: input.titulo.trim(),
      descricao: input.descricao,
      urgencia: input.urgencia,
      foto_path: input.fotoPath,
    })
    .eq('id', id)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('Esta requisição não pode mais ser editada (já foi decidida pelo Administrador).')
  }
}

// Só o Administrador (RLS + trigger). Recusar exige o motivo (check do banco).
export async function decidirRequisicao(id: string, status: RequisicaoStatus, motivoRecusa?: string): Promise<void> {
  const { data, error } = await supabase
    .from('requisicoes')
    .update({ status, motivo_recusa: status === 'recusada' ? (motivoRecusa?.trim() ?? '') : null })
    .eq('id', id)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('Sem permissão para decidir esta requisição.')
}

export async function excluirRequisicao(r: RequisicaoRow): Promise<void> {
  const { data, error } = await supabase.from('requisicoes').delete().eq('id', r.id).select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('Sem permissão para excluir esta requisição.')
  // A foto fica órfã no bucket se não sair junto; falhar aqui não desfaz a
  // exclusão (a requisição já foi), então o erro é ignorado.
  if (r.foto_path) await supabase.storage.from('requisicoes-fotos').remove([r.foto_path]).catch(() => undefined)
}

// ---- Foto (bucket privado `requisicoes-fotos`, pasta = id de quem sobe) ----

// Celular tira foto de vários MB; reduz pra no máximo 1600px de lado em JPEG
// antes de subir (o suficiente pra ver o defeito / o item).
export async function reduzirImagem(file: File, ladoMax = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const escala = Math.min(1, ladoMax / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível processar a imagem.'))), 'image/jpeg', 0.82),
  )
}

export async function uploadRequisicaoFoto(userId: string, file: File): Promise<string> {
  const blob = await reduzirImagem(file)
  const path = `${userId}/${Date.now()}.jpg`
  const { error } = await supabase.storage.from('requisicoes-fotos').upload(path, blob, { contentType: 'image/jpeg' })
  if (error) throw error
  return path
}

export async function removerRequisicaoFoto(path: string): Promise<void> {
  await supabase.storage.from('requisicoes-fotos').remove([path]).catch(() => undefined)
}

export function useRequisicaoFotoUrl(path: string | null) {
  return useQuery({
    queryKey: ['requisicao-foto', path],
    enabled: !!path,
    staleTime: 4 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('requisicoes-fotos').createSignedUrl(path as string, 300)
      if (error) throw error
      return data.signedUrl
    },
  })
}
