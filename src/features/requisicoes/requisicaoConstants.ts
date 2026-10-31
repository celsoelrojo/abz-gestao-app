import type { RequisicaoStatus, RequisicaoTipo, RequisicaoUrgencia } from '../../types/database'

export const REQUISICAO_TIPOS: RequisicaoTipo[] = ['compra', 'conserto']
export const REQUISICAO_TIPO_LABELS: Record<RequisicaoTipo, string> = {
  compra: 'Compra',
  conserto: 'Conserto',
}

export const REQUISICAO_URGENCIAS: RequisicaoUrgencia[] = ['baixa', 'media', 'alta']
export const REQUISICAO_URGENCIA_LABELS: Record<RequisicaoUrgencia, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
}

export const REQUISICAO_STATUS_LABELS: Record<RequisicaoStatus, string> = {
  pendente: 'Pendente',
  aprovada: 'Aprovada',
  concluida: 'Concluída',
  recusada: 'Recusada',
}

// Só 3 variantes de badge existem no tema (mesmo reaproveitamento de Reservas).
export const REQUISICAO_STATUS_BADGE_CLASS: Record<RequisicaoStatus, string> = {
  pendente: 'badge-status-pendente',
  aprovada: 'badge-status-ativa',
  concluida: 'badge-status-ativa',
  recusada: 'badge-status-bloqueada',
}

export const REQUISICAO_URGENCIA_BADGE_CLASS: Record<RequisicaoUrgencia, string> = {
  baixa: 'badge-status-ativa',
  media: 'badge-status-pendente',
  alta: 'badge-status-bloqueada',
}
