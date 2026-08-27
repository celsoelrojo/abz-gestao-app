import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { EstoqueCategoria, EstoqueItemRow, EstoqueMovimentoRow, TaxonomiaRow } from '../../types/database'

export const ESTOQUE_ITENS_KEY = ['estoque_itens']
export const ESTOQUE_MOVIMENTOS_KEY = ['estoque_movimentos']
export const TAXONOMIAS_KEY = (modulo: string) => ['taxonomias', modulo]

// RLS já restringe pra categoria do próprio setor (ou tudo, se Administrador)
// — o client só pede tudo que existir.
export function useEstoqueItens() {
  return useQuery({
    queryKey: ESTOQUE_ITENS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('estoque_itens').select('*').order('title')
      if (error) throw error
      return data as EstoqueItemRow[]
    },
  })
}

// Histórico completo de movimentos (entradas + saídas + estornos) — os
// filtros da aba Retirada são aplicados no client sobre esta mesma lista,
// igual ao protótipo (não há tela própria de "histórico de entradas").
export function useEstoqueMovimentos() {
  return useQuery({
    queryKey: ESTOQUE_MOVIMENTOS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_movimentos')
        .select('*')
        .order('data_hora', { ascending: false })
      if (error) throw error
      return data as EstoqueMovimentoRow[]
    },
  })
}

export function useTaxonomias(modulo: 'estoque' | 'ficha_tecnica' | 'ficha_producao' | 'pop') {
  return useQuery({
    queryKey: TAXONOMIAS_KEY(modulo),
    queryFn: async () => {
      const { data, error } = await supabase.from('taxonomias').select('*').eq('modulo', modulo)
      if (error) throw error
      return data as TaxonomiaRow[]
    },
  })
}

// Sugestões de categoria/subcategoria pro setor — mesma mecânica do
// protótipo (fichaCategoriasPorSetor/estoqueCategoriasPorSetor etc.), só que
// numa tabela genérica (taxonomias) em vez de um objeto por módulo em
// memória. São só sugestões de datalist; o usuário pode digitar livre.
export function taxonomiaValores(taxonomias: TaxonomiaRow[], setor: string, tipo: 'categoria' | 'subcategoria') {
  return taxonomias.filter((t) => t.setor === setor && t.tipo === tipo).map((t) => t.valor)
}

// Registra categoria/subcategoria novas na tabela de sugestões — ignora
// silenciosamente se já existir (unique constraint faz esse trabalho; 23505
// = unique_violation).
export async function registrarTaxonomia(
  modulo: 'estoque' | 'ficha_tecnica' | 'ficha_producao' | 'pop',
  setor: string,
  categoria: string,
  subcategoria: string,
) {
  const rows: { modulo: string; setor: string; tipo: 'categoria' | 'subcategoria'; valor: string }[] = []
  if (categoria.trim()) rows.push({ modulo, setor, tipo: 'categoria', valor: categoria.trim() })
  if (subcategoria.trim()) rows.push({ modulo, setor, tipo: 'subcategoria', valor: subcategoria.trim() })
  if (!rows.length) return
  const { error } = await supabase.from('taxonomias').insert(rows)
  if (error && error.code !== '23505') throw error
}

// Realtime: qualquer INSERT/UPDATE/DELETE em itens ou movimentos invalida o
// cache — é assim que uma entrada/retirada lançada por outro usuário (ou
// pela conclusão de uma tarefa de produção no Checklist) aparece na hora.
export function useEstoqueRealtime() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel('estoque:all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estoque_itens' }, () => {
        queryClient.invalidateQueries({ queryKey: ESTOQUE_ITENS_KEY })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estoque_movimentos' }, () => {
        queryClient.invalidateQueries({ queryKey: ESTOQUE_MOVIMENTOS_KEY })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}

// Acha um item existente (case-insensitive, mesma categoria) ou cria um novo
// com saldo zerado — mesma lógica de findOrCreateEstoqueItem do protótipo,
// usada tanto por "Dar Entrada" (produto digitado livre) quanto pelo fluxo
// de Entrada por Produção do Checklist (quando existir).
export async function findOrCreateEstoqueItem(
  categoria: EstoqueCategoria,
  title: string,
  unidade: EstoqueItemRow['unidade'],
  produtoCategoria: string | null = null,
  subcategoria: string | null = null,
): Promise<EstoqueItemRow> {
  const { data: existing, error: selectError } = await supabase
    .from('estoque_itens')
    .select('*')
    .eq('categoria', categoria)
    .ilike('title', title.trim())
    .maybeSingle()
  if (selectError) throw selectError

  if (existing) {
    const item = existing as EstoqueItemRow
    const patch: Partial<Pick<EstoqueItemRow, 'produto_categoria' | 'subcategoria'>> = {}
    if (produtoCategoria !== null && produtoCategoria !== item.produto_categoria) patch.produto_categoria = produtoCategoria
    if (subcategoria !== null && subcategoria !== item.subcategoria) patch.subcategoria = subcategoria
    if (Object.keys(patch).length === 0) return item
    // Um funcionário comum (não-gestor) pode lançar entrada mas não tem
    // permissão de UPDATE em estoque_itens (RLS) — nesse caso a
    // classificação simplesmente não é atualizada, mas a entrada em si
    // (via RPC, que roda com privilégio próprio) continua funcionando.
    const { data: updated, error: updateError } = await supabase
      .from('estoque_itens')
      .update(patch)
      .eq('id', item.id)
      .select('*')
      .single()
    if (updateError) return item
    return updated as EstoqueItemRow
  }

  const { data: created, error: insertError } = await supabase
    .from('estoque_itens')
    .insert({ categoria, title: title.trim(), quantidade: 0, unidade, produto_categoria: produtoCategoria, subcategoria })
    .select('*')
    .single()
  if (insertError) throw insertError
  return created as EstoqueItemRow
}
