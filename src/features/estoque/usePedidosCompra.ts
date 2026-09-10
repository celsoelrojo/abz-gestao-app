import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import { isoDate } from '../../lib/date'
import { supabase } from '../../lib/supabaseClient'
import type { EstoqueCategoria, EstoqueUnidade, PedidoCompraItemRow, PedidoCompraRow } from '../../types/database'

export const PEDIDOS_COMPRA_KEY = ['pedidos_compra']
export const PEDIDO_COMPRA_ITENS_KEY = (pedidoId: string) => ['pedidos_compra_itens', pedidoId]

// RLS já garante: qualquer perfil não-freelancer lê; só Administrador cria.
export function usePedidosCompra() {
  return useQuery({
    queryKey: PEDIDOS_COMPRA_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pedidos_compra')
        .select('*')
        .order('data_entrega', { ascending: false })
        .order('criado_em', { ascending: false })
      if (error) throw error
      return data as PedidoCompraRow[]
    },
  })
}

// Pedidos com entrega marcada pra HOJE e ainda não recebidos — alimenta o
// aviso "Mercadoria a receber hoje" no painel de Mensagens Importantes da
// Home. Some sozinho quando alguém finaliza o recebimento (realtime).
export function usePedidosAReceberHoje() {
  return useQuery({
    queryKey: ['pedidos_a_receber_hoje'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pedidos_compra')
        .select('id, fornecedor')
        .eq('status', 'aberto')
        .eq('data_entrega', isoDate(new Date()))
        .order('fornecedor')
      if (error) throw error
      return data as { id: string; fornecedor: string }[]
    },
  })
}

export function usePedidoCompraItens(pedidoId: string | undefined) {
  return useQuery({
    queryKey: PEDIDO_COMPRA_ITENS_KEY(pedidoId ?? ''),
    enabled: !!pedidoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pedidos_compra_itens')
        .select('*')
        .eq('pedido_id', pedidoId!)
        .order('ordem')
      if (error) throw error
      return data as PedidoCompraItemRow[]
    },
  })
}

export function usePedidosCompraRealtime() {
  const queryClient = useQueryClient()
  useEffect(() => {
    const channel = supabase
      .channel('pedidos_compra:all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos_compra' }, () => {
        queryClient.invalidateQueries({
          predicate: (q) => q.queryKey[0] === 'pedidos_compra' || q.queryKey[0] === 'pedidos_a_receber_hoje',
        })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos_compra_itens' }, () => {
        queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'pedidos_compra_itens' })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}

export interface NovoPedidoItem {
  estoqueItemId: string
  produto: string
  categoria: EstoqueCategoria
  unidade: EstoqueUnidade
  quantidade: number
}

export async function criarPedidoCompra(input: {
  fornecedor: string
  dataEntrega: string
  horaEntrega: string | null
  espelhoUrl: string | null
  observacoes: string | null
  itens: NovoPedidoItem[]
}): Promise<void> {
  const criadoPor = useAuthStore.getState().profile?.id ?? null
  const { data: pedido, error } = await supabase
    .from('pedidos_compra')
    .insert({
      fornecedor: input.fornecedor.trim(),
      data_entrega: input.dataEntrega,
      hora_entrega: input.horaEntrega,
      espelho_url: input.espelhoUrl,
      observacoes: input.observacoes,
      criado_por: criadoPor,
    })
    .select('id')
    .single()
  if (error) throw error

  const { error: itensError } = await supabase.from('pedidos_compra_itens').insert(
    input.itens.map((it, i) => ({
      pedido_id: pedido.id,
      estoque_item_id: it.estoqueItemId,
      produto: it.produto,
      categoria: it.categoria,
      unidade: it.unidade,
      quantidade: it.quantidade,
      ordem: i,
    })),
  )
  if (itensError) {
    // Rollback manual — o cabeçalho já entrou, mas sem itens não serve.
    await supabase.from('pedidos_compra').delete().eq('id', pedido.id)
    throw itensError
  }
}

// Conferência de um item (Receber Mercadoria) — RLS só deixa não-freelancer
// e só enquanto o pedido está aberto.
export async function conferirItem(
  itemId: string,
  patch: { recebido?: boolean; quantidade_recebida?: number | null; observacao?: string | null },
): Promise<void> {
  const { error } = await supabase.from('pedidos_compra_itens').update(patch).eq('id', itemId)
  if (error) throw error
}

export async function finalizarRecebimento(pedidoId: string): Promise<void> {
  const { error } = await supabase.rpc('finalizar_recebimento', { p_pedido_id: pedidoId })
  if (error) throw error
}

export async function excluirPedidoCompra(pedidoId: string): Promise<void> {
  const { error } = await supabase.from('pedidos_compra').delete().eq('id', pedidoId)
  if (error) throw error
}

// Espelho: bucket privado — upload sob `<data>/<timestamp>-<nome>`, exibição
// via signed URL de curta duração (getPublicUrl não serve bucket privado).
export async function uploadEspelho(file: File): Promise<string> {
  const path = `${new Date().toISOString().slice(0, 10)}/${Date.now()}-${file.name}`
  const { error } = await supabase.storage.from('pedidos-espelhos').upload(path, file)
  if (error) throw error
  return path
}

export async function espelhoUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('pedidos-espelhos').createSignedUrl(path, 300)
  if (error) throw error
  return data.signedUrl
}
