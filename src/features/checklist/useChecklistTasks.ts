import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { ChecklistConclusaoRow, ChecklistResponsavelDiaRow, ChecklistTaskRow, Setor } from '../../types/database'

export const CHECKLIST_TASKS_KEY = ['checklist_tasks']
export const CHECKLIST_TASKS_ALL_KEY = ['checklist_tasks', 'all']
export const CHECKLIST_CONCLUSOES_RANGE_KEY = (startIso: string, endIso: string) => [
  'checklist_conclusoes',
  startIso,
  endIso,
]
export const CHECKLIST_RESPONSAVEL_DIA_RANGE_KEY = (startIso: string, endIso: string) => [
  'checklist_responsavel_dia',
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

// Usuários que podem ser "responsável" num setor — reaproveitada pelo
// formulário de tarefa (Gerenciar Checklist) e pela troca rápida do dia
// (ChecklistPage). profiles_select_own_or_admin (migration 0001) não deixa
// um Gestor listar os colegas direto, por isso a RPC dedicada (0037).
export function useResponsaveisDisponiveis(setor: Setor) {
  return useQuery({
    queryKey: ['checklist_responsaveis_disponiveis', setor],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('checklist_responsaveis_disponiveis', { p_setor: setor })
      if (error) throw error
      return data
    },
  })
}

// Override de responsável num intervalo de datas — mesmo padrão de
// useChecklistConclusoesRange (uma query pra semana toda + próximos 5 dias).
export function useChecklistResponsavelDiaRange(startIso: string, endIso: string) {
  return useQuery({
    queryKey: CHECKLIST_RESPONSAVEL_DIA_RANGE_KEY(startIso, endIso),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_responsavel_dia')
        .select('*')
        .gte('data_referencia', startIso)
        .lte('data_referencia', endIso)
      if (error) throw error
      return data as ChecklistResponsavelDiaRow[]
    },
  })
}

// Troca o responsável de UMA tarefa só naquele dia — pedido do usuário:
// "não é necessário pedir confirmação", então é upsert direto (sem
// window.confirm/ConfirmModal). RLS (checklist_responsavel_dia_write,
// migration 0038) garante Gestor só no próprio setor e Administrador em
// qualquer um; o client não precisa checar de novo.
export async function definirResponsavelDia(
  taskId: number,
  dataReferencia: string,
  responsavelId: string,
  responsavelNome: string,
  alteradoPor: string,
): Promise<void> {
  const { error } = await supabase.from('checklist_responsavel_dia').upsert({
    task_id: taskId,
    data_referencia: dataReferencia,
    responsavel_id: responsavelId,
    responsavel_nome: responsavelNome,
    alterado_por: alteradoPor,
    alterado_em: new Date().toISOString(),
  })
  if (error) throw error
}

// "Usar responsável padrão da tarefa" — apaga o override do dia.
export async function removerResponsavelDia(taskId: number, dataReferencia: string): Promise<void> {
  const { error } = await supabase
    .from('checklist_responsavel_dia')
    .delete()
    .eq('task_id', taskId)
    .eq('data_referencia', dataReferencia)
  if (error) throw error
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_responsavel_dia' }, () => {
        queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'checklist_responsavel_dia' })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}
