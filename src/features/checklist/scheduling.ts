import { isoDate, weekdayNameForDate } from '../../lib/date'
import type { ChecklistTaskRow, Weekday } from '../../types/database'

// Em qual "semana do mês" (1ª..5ª) uma data cai — dias 1-7 são a 1ª semana,
// 8-14 a 2ª, e assim por diante. Como cada bloco de 7 dias contém exatamente
// uma ocorrência de cada dia da semana, isso equivale a "a Nª ocorrência
// daquele dia da semana no mês" (mesma lógica do protótipo, script.js).
function weekOfMonth(date: Date): number {
  return Math.ceil(date.getDate() / 7)
}

// "Última semana do mês" é a última ocorrência DAQUELE dia da semana no mês
// (ex.: a última sexta-feira) — não necessariamente o último bloco de 7 dias,
// já que a cauda do mês pode não conter aquele dia da semana específico.
function isLastWeekOfMonth(date: Date): boolean {
  const nextOccurrence = new Date(date)
  nextOccurrence.setDate(date.getDate() + 7)
  return nextOccurrence.getMonth() !== date.getMonth()
}

// Só os campos de agenda importam pra essa lógica — Pick em vez de
// ChecklistTaskRow inteiro, pra também aceitar o recorte mínimo devolvido
// por checklist_agenda_todos_setores() (usado no resumo do dia da Home, que
// precisa somar tarefas de todos os setores sem expor título/descrição/
// responsável de setores que a RLS normalmente esconde).
type TarefaAgendavel = Pick<ChecklistTaskRow, 'active' | 'periodicidade' | 'data_unica' | 'dias' | 'semanas_do_mes'>

function matchesSemanaDoMes(task: TarefaAgendavel, date: Date): boolean {
  if (!task.semanas_do_mes.length) return true
  const w = String(weekOfMonth(date))
  if (task.semanas_do_mes.includes(w)) return true
  if (task.semanas_do_mes.includes('ultima') && isLastWeekOfMonth(date)) return true
  return false
}

// Espelha isTaskScheduledOn() do protótipo: Única ignora `dias` e compara
// data exata; todas as outras periodicidades exigem `dias.includes(weekday)`
// (Diária/"A cada turno" só funcionam porque a tarefa é criada com os 7 dias
// marcados — ver migration 0015, que corrige o seed antigo); Mensal/Quinzenal
// checam adicionalmente `semanas_do_mes`.
export function isTaskScheduledOn(task: TarefaAgendavel, date: Date): boolean {
  if (!task.active) return false
  if (task.periodicidade === 'Única') return task.data_unica === isoDate(date)
  const weekday = weekdayNameForDate(date) as Weekday
  if (!task.dias.includes(weekday)) return false
  if (task.periodicidade === 'Mensal' || task.periodicidade === 'Quinzenal') {
    return matchesSemanaDoMes(task, date)
  }
  return true
}

// Semana corrente (Segunda-Domingo) contendo `baseDate` — usada como piso da
// busca por atraso (o "atraso" reseta toda semana, igual ao protótipo).
export function getWeekDates(baseDate: Date): Date[] {
  const day = baseDate.getDay() // 0 = Domingo
  const mondayOffset = day === 0 ? -6 : 1 - day
  const monday = new Date(baseDate)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(baseDate.getDate() + mondayOffset)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

// Janela rolante de N dias a partir de amanhã, cruzando limites de
// semana/mês — usada pelo painel "Próximos N dias".
export function getUpcomingDays(n: number, baseDate: Date = new Date()): Date[] {
  const days: Date[] = []
  for (let i = 1; i <= n; i++) {
    const dt = new Date(baseDate)
    dt.setHours(0, 0, 0, 0)
    dt.setDate(dt.getDate() + i)
    days.push(dt)
  }
  return days
}

export interface OverdueInfo {
  missedDate: string
  daysLate: number
}

// Procura, dentro da semana atual (a partir de segunda-feira), a mais antiga
// ocorrência programada e ainda não concluída antes de hoje. `completedDates`
// é a lista de `data_referencia` já concluídas pra essa tarefa (dentro da
// janela relevante) — equivalente ao `lastCompletedDate` do protótipo, só
// que aqui uma linha por dia permite achar o "mais recente concluído" sem
// precisar de um campo dedicado.
export function findOverdueInfo(
  task: ChecklistTaskRow,
  week: Date[],
  todayDate: Date,
  completedDates: string[],
): OverdueInfo | null {
  if (!task.active) return null
  const todayIso = isoDate(todayDate)
  let cursor = new Date(week[0])

  const lastCompleted = completedDates
    .filter((d) => d <= todayIso)
    .sort()
    .at(-1)
  if (lastCompleted) {
    const dayAfterDone = new Date(`${lastCompleted}T00:00:00`)
    dayAfterDone.setDate(dayAfterDone.getDate() + 1)
    if (dayAfterDone > cursor) cursor = dayAfterDone
  }

  while (isoDate(cursor) < todayIso) {
    if (isTaskScheduledOn(task, cursor)) {
      const daysLate = Math.round((todayDate.getTime() - cursor.getTime()) / 86400000)
      return { missedDate: isoDate(cursor), daysLate }
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return null
}
