// Mesma lógica do isoDate()/weekdayNameForDate() do protótipo — data local
// (não UTC), pra bater com o fuso do usuário em vez do servidor.

export function isoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// O bar pode funcionar até as 2h; o expediente só "vira" às 5h. Antes disso,
// o dia operacional ainda é o de ontem — o fechamento feito de madrugada
// conta como do dia anterior, não como tarefa atrasada.
export const HORA_VIRADA_DIA = 5

// Meia-noite do dia operacional de `agora` (sempre à 00:00, pra bater com as
// datas de agenda e dar contagem exata de dias de atraso).
export function diaOperacional(agora: Date = new Date()): Date {
  const d = new Date(agora)
  d.setHours(d.getHours() - HORA_VIRADA_DIA)
  d.setHours(0, 0, 0, 0)
  return d
}

const WEEKDAYS_BY_JS_INDEX =['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export function weekdayNameForDate(date: Date): string {
  return WEEKDAYS_BY_JS_INDEX[date.getDay()]
}

export function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const MONTH_NAMES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

const WEEKDAY_FULL: Record<string, string> = {
  Segunda: 'Segunda-feira',
  Terça: 'Terça-feira',
  Quarta: 'Quarta-feira',
  Quinta: 'Quinta-feira',
  Sexta: 'Sexta-feira',
  Sábado: 'Sábado',
  Domingo: 'Domingo',
}

export function formatWeekdayLong(date: Date, weekdayName: string): string {
  return `${WEEKDAY_FULL[weekdayName]}, ${date.getDate()} de ${MONTH_NAMES[date.getMonth()]}`
}
