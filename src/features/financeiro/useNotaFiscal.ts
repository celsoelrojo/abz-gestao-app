import { useQuery } from '@tanstack/react-query'
import { blobParaBase64, reduzirImagem } from '../../lib/imagem'
import { supabase } from '../../lib/supabaseClient'
import { sanearNota, type NotaLida } from './notaHelpers'
import type { ItemNotaSalvo, NotaMapeamentoRow } from '../../types/database'

export const NOTA_MAPEAMENTOS_KEY = ['nota_mapeamentos']

// Nota fiscal tem letra miúda: mais resolução que a foto de requisição.
const LADO_MAX_NOTA = 2000

export interface NotaLidaComFoto {
  nota: NotaLida
  foto: Blob
}

// A foto vai reduzida para a função `ler-nota` (que chama a IA no servidor, com
// a chave guardada lá). A resposta é sempre "saneada" antes de ir pra tela.
export async function lerNotaFiscal(file: File): Promise<NotaLidaComFoto> {
  const foto = await reduzirImagem(file, LADO_MAX_NOTA, 0.85)
  const imagem_base64 = await blobParaBase64(foto)
  const { data, error } = await supabase.functions.invoke('ler-nota', {
    body: { imagem_base64, media_type: 'image/jpeg' },
  })
  if (error) {
    // FunctionsHttpError guarda a Response; a mensagem útil vem no corpo.
    const resposta = (error as { context?: Response }).context
    const corpo = resposta ? await resposta.json().catch(() => null) : null
    throw new Error(corpo?.error ?? 'Não foi possível ler a nota. Tente novamente.')
  }
  return { nota: sanearNota(data?.nota), foto }
}

export function useNotaMapeamentos() {
  return useQuery({
    queryKey: NOTA_MAPEAMENTOS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('nota_mapeamentos').select('*')
      if (error) throw error
      return data as NotaMapeamentoRow[]
    },
  })
}

export async function uploadNotaFoto(userId: string, foto: Blob): Promise<string> {
  const path = `${userId}/${Date.now()}.jpg`
  const { error } = await supabase.storage.from('notas-fiscais').upload(path, foto, { contentType: 'image/jpeg' })
  if (error) throw error
  return path
}

export async function removerNotaFoto(path: string): Promise<void> {
  await supabase.storage.from('notas-fiscais').remove([path]).catch(() => undefined)
}

export function useNotaFotoUrl(path: string | null) {
  return useQuery({
    queryKey: ['nota-foto', path],
    enabled: !!path,
    staleTime: 4 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('notas-fiscais').createSignedUrl(path as string, 300)
      if (error) throw error
      return data.signedUrl
    },
  })
}

export interface LancamentoNota {
  descricao: string
  fornecedor: string
  fornecedorCnpj: string
  categoria: string
  valor: number
  vencimento: string
  observacoes: string
  numeroNota: string
  chaveAcesso: string
  fotoPath: string | null
  itensNota: ItemNotaSalvo[]
  pagoEm: string | null
  formaPagamento: string | null
}

export interface LancamentoItem {
  estoqueItemId: string
  quantidade: number
  darEntrada: boolean
  descricaoNorm: string
}

// Tudo numa transação no banco (função registrar_nota_compra, migration 0049):
// conta a pagar + entrada de estoque + aprendizado. Se algo falhar, nada fica
// pela metade.
export async function lancarNota(l: LancamentoNota, itens: LancamentoItem[], fornecedorChave: string): Promise<string> {
  const { data, error } = await supabase.rpc('registrar_nota_compra', {
    p_conta: {
      descricao: l.descricao.trim(),
      fornecedor: l.fornecedor.trim(),
      fornecedor_cnpj: l.fornecedorCnpj,
      categoria: l.categoria,
      valor: l.valor,
      vencimento: l.vencimento,
      observacoes: l.observacoes.trim(),
      numero_nota: l.numeroNota.trim(),
      chave_acesso: l.chaveAcesso,
      nota_foto_path: l.fotoPath ?? '',
      itens_nota: l.itensNota,
      pago_em: l.pagoEm ?? '',
      valor_pago: l.pagoEm ? l.valor : '',
      forma_pagamento: l.formaPagamento ?? '',
    },
    p_itens: itens.map((i) => ({
      estoque_item_id: i.estoqueItemId,
      quantidade: i.quantidade,
      dar_entrada: i.darEntrada,
      descricao_norm: i.descricaoNorm,
    })),
    p_fornecedor_chave: fornecedorChave,
  })
  if (error) {
    if (error.code === '23505') throw new Error('Esta nota já foi lançada (a chave de acesso já existe no sistema).')
    throw error
  }
  return data as string
}
