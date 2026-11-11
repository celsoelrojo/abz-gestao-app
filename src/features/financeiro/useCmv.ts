import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { momentoFinal, momentoInicial, type Periodo } from './cmvHelpers'
import type { EstoqueCustoRow, FaturamentoDiaRow } from '../../types/database'

// Tudo aqui é exclusivo do Administrador: a RLS (migration 0050) devolve vazio
// pra qualquer outro perfil.

export const ESTOQUE_CUSTOS_KEY = ['estoque_custos']
export const FATURAMENTO_KEY = ['faturamento_diario']
export const SALDOS_KEY = ['estoque_saldos_em']

export function useEstoqueCustos() {
  return useQuery({
    queryKey: ESTOQUE_CUSTOS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('estoque_custos').select('*')
      if (error) throw error
      return data as EstoqueCustoRow[]
    },
  })
}

export function useFaturamento(periodo: Periodo) {
  return useQuery({
    queryKey: [...FATURAMENTO_KEY, periodo.inicio, periodo.fim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('faturamento_diario')
        .select('*')
        .gte('data', periodo.inicio)
        .lte('data', periodo.fim)
        .order('data', { ascending: true })
      if (error) throw error
      return data as FaturamentoDiaRow[]
    },
  })
}

// Saldo de cada produto num momento do passado (função estoque_saldos_em).
export function useSaldosEm(momento: string) {
  return useQuery({
    queryKey: [...SALDOS_KEY, momento],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('estoque_saldos_em', { p_momento: momento })
      if (error) throw error
      return new Map((data ?? []).map((s) => [s.item_id, Number(s.quantidade)]))
    },
  })
}

export function useSaldosDoPeriodo(periodo: Periodo) {
  const inicial = useSaldosEm(momentoInicial(periodo))
  const final = useSaldosEm(momentoFinal(periodo))
  return { inicial, final }
}

// custo = null remove o custo do produto (volta a "sem custo").
export async function salvarCusto(itemId: string, custo: number | null): Promise<void> {
  if (custo == null) {
    const { error } = await supabase.from('estoque_custos').delete().eq('item_id', itemId)
    if (error) throw error
    return
  }
  const { error } = await supabase
    .from('estoque_custos')
    .upsert({ item_id: itemId, custo_unitario: custo, origem: 'manual' }, { onConflict: 'item_id' })
  if (error) throw error
}

// valor = null apaga o lançamento do dia; 0 = dia fechado / sem movimento.
export async function salvarFaturamentoDias(linhas: { data: string; valor: number | null }[]): Promise<void> {
  const gravar = linhas.filter((l): l is { data: string; valor: number } => l.valor != null)
  const apagar = linhas.filter((l) => l.valor == null).map((l) => l.data)
  if (gravar.length > 0) {
    const { error } = await supabase.from('faturamento_diario').upsert(gravar, { onConflict: 'data' })
    if (error) throw error
  }
  if (apagar.length > 0) {
    const { error } = await supabase.from('faturamento_diario').delete().in('data', apagar)
    if (error) throw error
  }
}
