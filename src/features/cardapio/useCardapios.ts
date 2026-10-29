import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { CardapioDia, CardapioRow } from '../../types/database'

export const CARDAPIOS_KEY = ['cardapios']

// RLS já restringe a Administrador + setor Cozinha (migration 0044) — o
// client só pede tudo que existir. Semana mais recente primeiro.
export function useCardapios() {
  return useQuery({
    queryKey: CARDAPIOS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('cardapios').select('*').order('semana_inicio', { ascending: false })
      if (error) throw error
      return data as CardapioRow[]
    },
  })
}

export function useCardapiosRealtime() {
  const queryClient = useQueryClient()
  useEffect(() => {
    const channel = supabase
      .channel('cardapios:all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cardapios' }, () => {
        queryClient.invalidateQueries({ queryKey: CARDAPIOS_KEY })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}

export interface CardapioInput {
  semanaInicio: string
  observacoes: string | null
  dias: CardapioDia[]
}

// semana_inicio é UNIQUE: uma semana só tem um cardápio. 23505 vira mensagem
// amigável em vez do erro cru do Postgres.
export async function criarCardapio(input: CardapioInput): Promise<void> {
  const { error } = await supabase
    .from('cardapios')
    .insert({ semana_inicio: input.semanaInicio, observacoes: input.observacoes, dias: input.dias })
  if (error) {
    if (error.code === '23505') {
      throw new Error('Já existe um cardápio para esta semana. Edite-o em "Visualizar cardápio".')
    }
    throw error
  }
}

// A semana não muda na edição (o formulário trava o campo) — só os pratos e as
// observações.
export async function atualizarCardapio(id: string, input: CardapioInput): Promise<void> {
  const { error } = await supabase
    .from('cardapios')
    .update({ observacoes: input.observacoes, dias: input.dias })
    .eq('id', id)
  if (error) throw error
}

// Só Administrador ou Gestor da Cozinha (RLS cardapios_delete) — pra qualquer
// outro a RLS apaga 0 linhas sem erro, então o .select() confirma que algo
// foi mesmo removido.
export async function excluirCardapio(id: string): Promise<void> {
  const { data, error } = await supabase.from('cardapios').delete().eq('id', id).select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('Sem permissão para excluir este cardápio.')
}
