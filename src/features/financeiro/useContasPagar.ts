import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { gerarVencimentos } from './contaHelpers'
import { removerNotaFoto } from './useNotaFiscal'
import type { ContaPagarRow } from '../../types/database'

export const CONTAS_PAGAR_KEY = ['contas_pagar']

// A RLS (migration 0049) só devolve linhas ao Administrador.
export function useContasPagar() {
  return useQuery({
    queryKey: CONTAS_PAGAR_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('contas_pagar').select('*').order('vencimento', { ascending: true })
      if (error) throw error
      return data as ContaPagarRow[]
    },
  })
}

export function useContasPagarRealtime() {
  const queryClient = useQueryClient()
  useEffect(() => {
    const channel = supabase
      .channel('contas_pagar:all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contas_pagar' }, () => {
        queryClient.invalidateQueries({ queryKey: CONTAS_PAGAR_KEY })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}

export interface ContaInput {
  descricao: string
  fornecedor: string | null
  categoria: string
  valor: number
  vencimento: string
  observacoes: string | null
}

// `repeticoes` > 1 = a mesma conta todo mês: uma linha por mês, ligadas por
// grupo_id (parcela N de M) — cada mês pode ser paga/editada à parte. Todas
// entram num único insert (atômico: ou cria todas, ou nenhuma).
export async function criarContas(input: ContaInput, repeticoes: number): Promise<void> {
  const vencimentos = gerarVencimentos(input.vencimento, repeticoes)
  const grupoId = repeticoes > 1 ? crypto.randomUUID() : null
  const linhas = vencimentos.map((vencimento, i) => ({
    ...input,
    vencimento,
    grupo_id: grupoId,
    parcela: grupoId ? i + 1 : null,
    parcelas: grupoId ? repeticoes : null,
  }))
  const { error } = await supabase.from('contas_pagar').insert(linhas)
  if (error) throw error
}

// Edita só esta conta (não as outras parcelas do grupo).
export async function atualizarConta(id: string, input: ContaInput): Promise<void> {
  const { data, error } = await supabase.from('contas_pagar').update(input).eq('id', id).select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('Conta não encontrada ou sem permissão para editar.')
}

export interface PagamentoInput {
  pagoEm: string
  valorPago: number
  formaPagamento: string | null
}

export async function registrarPagamento(id: string, p: PagamentoInput): Promise<void> {
  const { data, error } = await supabase
    .from('contas_pagar')
    .update({ pago_em: p.pagoEm, valor_pago: p.valorPago, forma_pagamento: p.formaPagamento })
    .eq('id', id)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('Conta não encontrada ou sem permissão.')
}

export async function desfazerPagamento(id: string): Promise<void> {
  const { data, error } = await supabase
    .from('contas_pagar')
    .update({ pago_em: null, valor_pago: null, forma_pagamento: null })
    .eq('id', id)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('Conta não encontrada ou sem permissão.')
}

export async function excluirConta(conta: Pick<ContaPagarRow, 'id' | 'nota_foto_path'>): Promise<void> {
  const { data, error } = await supabase.from('contas_pagar').delete().eq('id', conta.id).select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('Conta não encontrada ou sem permissão para excluir.')
  // A foto da nota só serve a esta conta; sem ela o arquivo ficaria órfão no bucket.
  if (conta.nota_foto_path) await removerNotaFoto(conta.nota_foto_path)
}
