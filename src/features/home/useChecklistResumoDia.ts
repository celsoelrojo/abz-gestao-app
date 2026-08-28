import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { isoDate } from '../../lib/date'
import { isTaskScheduledOn } from '../checklist/scheduling'
import type { ChecklistAgendaRow, ChecklistConcluidaRow, Setor } from '../../types/database'

export const CHECKLIST_RESUMO_DIA_KEY = (dataIso: string) => ['checklist_resumo_dia', dataIso]

export interface ResumoTarefas {
  total: number
  feitas: number
}

export interface ChecklistResumoDia {
  geral: ResumoTarefas
  porSetor: Record<Setor, ResumoTarefas>
}

const SETORES: Setor[] = ['Bar', 'Cozinha', 'Salão']

// Duas barras da Home ("tarefas gerais do estabelecimento" e "tarefas do meu
// setor") — as RPCs (checklist_agenda_todos_setores/checklist_concluidas_em,
// migration 0026) devolvem só os campos de agenda de TODA tarefa ativa e
// quais têm conclusão na data pedida, cruzando setores que a RLS normal de
// checklist_tasks esconderia. "Agendada hoje?" continua calculado aqui com a
// MESMA função já testada do módulo Checklist (scheduling.ts), em vez de
// duplicar essa lógica em SQL.
export function useChecklistResumoDia(dataIso: string = isoDate(new Date())) {
  return useQuery({
    queryKey: CHECKLIST_RESUMO_DIA_KEY(dataIso),
    queryFn: async (): Promise<ChecklistResumoDia> => {
      const [agendaRes, concluidasRes] = await Promise.all([
        supabase.rpc('checklist_agenda_todos_setores'),
        supabase.rpc('checklist_concluidas_em', { p_data: dataIso }),
      ])
      if (agendaRes.error) throw agendaRes.error
      if (concluidasRes.error) throw concluidasRes.error

      const hoje = new Date(`${dataIso}T00:00:00`)
      const agenda = (agendaRes.data ?? []) as ChecklistAgendaRow[]
      const concluidas = (concluidasRes.data ?? []) as ChecklistConcluidaRow[]
      const concluidasHojeIds = new Set(concluidas.map((c) => c.task_id))

      const agendadasHoje = agenda.filter((t) => isTaskScheduledOn({ ...t, active: true }, hoje))
      const contar = (tarefas: ChecklistAgendaRow[]): ResumoTarefas => ({
        total: tarefas.length,
        feitas: tarefas.filter((t) => concluidasHojeIds.has(t.id)).length,
      })

      const porSetor = {} as Record<Setor, ResumoTarefas>
      for (const setor of SETORES) {
        porSetor[setor] = contar(agendadasHoje.filter((t) => t.setor === setor))
      }

      return { geral: contar(agendadasHoje), porSetor }
    },
  })
}
