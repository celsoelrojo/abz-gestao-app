import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { payloadDaCotacao, type CotacaoComFilhos, type CotacaoEstado } from './cotacaoHelpers'

export const COTACOES_KEY = ['cotacoes']

// Administrador e Gestor Geral (RLS cotacoes_admin_all). Poucas cotações por vez,
// então uma consulta só traz fornecedores, produtos e preços de todas.
export function useCotacoes() {
  return useQuery({
    queryKey: COTACOES_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cotacoes')
        .select('*, cotacao_fornecedores(*), cotacao_itens(*, cotacao_precos(*))')
        .order('criado_em', { ascending: false })
      if (error) throw error
      return data as unknown as CotacaoComFilhos[]
    },
  })
}

// Cria ou reescreve o rascunho de uma vez (transação no banco); devolve o id.
export async function salvarCotacao(estado: CotacaoEstado): Promise<string> {
  const { data, error } = await supabase.rpc('salvar_cotacao', { p_id: estado.id, p_dados: payloadDaCotacao(estado) })
  if (error) throw error
  return data
}

// Um Pedido de Compra por fornecedor escolhido; devolve quantos pedidos foram criados.
export async function gerarPedidosDaCotacao(cotacaoId: string, dataEntrega: string): Promise<number> {
  const { data, error } = await supabase.rpc('gerar_pedidos_cotacao', { p_cotacao_id: cotacaoId, p_data_entrega: dataEntrega })
  if (error) throw error
  return data
}

// Gestor Geral: o banco não apaga e abre um pedido de autorização (0 linhas, sem erro).
export async function excluirCotacao(id: string): Promise<void> {
  const { error } = await supabase.from('cotacoes').delete().eq('id', id)
  if (error) throw error
}
