import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { ChecklistConclusaoRow, ChecklistTaskRow } from '../../types/database'

export const CHECKLIST_TASKS_KEY = ['checklist_tasks']
export const CHECKLIST_TASKS_ALL_KEY = ['checklist_tasks', 'all']
export const CHECKLIST_CONCLUSOES_RANGE_KEY = (startIso: string, endIso: string) => [
  'checklist_conclusoes',
  startIso,
  endIso,
]

// RLS já filtra pro setor certo — o client só pede tudo que está ativo, pra
// exibir na tela do dia a dia.
export function useChecklistTasks() {
  return useQuery({
    queryKey: CHECKLIST_TASKS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_tasks')
        .select('*')
        .eq('active', true)
        .order('posicao')
        .order('id')
      if (error) throw error
      return data as ChecklistTaskRow[]
    },
  })
}

// "Gerenciar Checklist" precisa ver tarefas inativas também, pra poder
// reativá-las — por isso não filtra active=true como useChecklistTasks.
export function useAllChecklistTasksForManage() {
  return useQuery({
    queryKey: CHECKLIST_TASKS_ALL_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('checklist_tasks').select('*').order('posicao').order('id')
      if (error) throw error
      return data as ChecklistTaskRow[]
    },
  })
}

// Conclusões num intervalo de datas — cobre de uma vez a semana corrente
// (pra achar atraso) e os próximos 5 dias (pra achar antecipação), em vez de
// uma query por dia.
export function useChecklistConclusoesRange(startIso: string, endIso: string) {
  return useQuery({
    queryKey: CHECKLIST_CONCLUSOES_RANGE_KEY(startIso, endIso),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_conclusoes')
        .select('*')
        .gte('data_referencia', startIso)
        .lte('data_referencia', endIso)
      if (error) throw error
      return data as ChecklistConclusaoRow[]
    },
  })
}

// Realtime: qualquer INSERT/UPDATE/DELETE em checklist_conclusoes invalida o
// cache de conclusões — é assim que uma conclusão (ou uma notificação de
// atraso resolvida) aparece na hora pro Gestor, sem F5, mesmo tendo sido
// outro usuário a agir. Sem filtro de data aqui (a tela usa uma janela
// grande, não um dia fixo), então o predicate cobre qualquer query de
// conclusões independente do intervalo pedido. Também invalida o resumo do
// dia (barras da Home), que depende da mesma tabela por baixo (RPC
// checklist_concluidas_em).
export function useChecklistRealtime() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel('checklist_conclusoes:all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_conclusoes' }, () => {
        queryClient.invalidateQueries({
          predicate: (q) => q.queryKey[0] === 'checklist_conclusoes' || q.queryKey[0] === 'checklist_resumo_dia',
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}
