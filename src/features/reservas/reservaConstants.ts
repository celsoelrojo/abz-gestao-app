import type { ReservaPeriodo, ReservaStatus } from '../../types/database'

export const RESERVA_PERIODOS: ReservaPeriodo[] = ['Almoço', 'Noite']

export const RESERVA_STATUS: ReservaStatus[] = [
  'pendente',
  'confirmada',
  'cancelada',
  'cliente_chegou',
  'em_atendimento',
  'concluida',
  'nao_compareceu',
]

export const RESERVA_STATUS_LABELS: Record<ReservaStatus, string> = {
  pendente: 'Pendente',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
  cliente_chegou: 'Cliente chegou',
  em_atendimento: 'Em atendimento',
  concluida: 'Concluída',
  nao_compareceu: 'Não compareceu',
}

export const RESERVA_ORIGENS = ['WhatsApp', 'Telefone', 'Instagram', 'Presencial', 'Site', 'Outro']
export const RESERVA_OCASIOES = ['Aniversário', 'Comemoração', 'Evento', 'Outro']

// Reaproveita as cores já usadas por Contas/Checklist/POP's (só 3 variantes
// de badge existem) — mesmo mapeamento do protótipo (RESERVA_STATUS_BADGE_CLASS).
export const RESERVA_STATUS_BADGE_CLASS: Record<ReservaStatus, string> = {
  pendente: 'badge-status-pendente',
  confirmada: 'badge-status-ativa',
  cancelada: 'badge-status-bloqueada',
  cliente_chegou: 'badge-status-ativa',
  em_atendimento: 'badge-status-ativa',
  concluida: 'badge-status-ativa',
  nao_compareceu: 'badge-status-bloqueada',
}
