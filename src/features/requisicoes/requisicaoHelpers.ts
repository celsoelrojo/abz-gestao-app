import type { ProfileRow, RequisicaoRow, RequisicaoStatus, RequisicaoUrgencia } from '../../types/database'

// "Abertas" = ainda pedem ação (esperando decisão ou já aprovadas, a fazer);
// "Encerradas" = concluídas ou recusadas.
export function requisicaoAberta(status: RequisicaoStatus): boolean {
  return status === 'pendente' || status === 'aprovada'
}

const URGENCIA_PESO: Record<RequisicaoUrgencia, number> = { alta: 0, media: 1, baixa: 2 }
const STATUS_PESO: Record<RequisicaoStatus, number> = { pendente: 0, aprovada: 1, concluida: 2, recusada: 3 }

// Abertas: o que espera decisão vem antes do que já foi aprovado; dentro de cada
// grupo, mais urgente primeiro e, empatando, a mais antiga (está esperando há
// mais tempo).
export function ordenarAbertas(lista: RequisicaoRow[]): RequisicaoRow[] {
  return [...lista].sort(
    (a, b) =>
      STATUS_PESO[a.status] - STATUS_PESO[b.status] ||
      URGENCIA_PESO[a.urgencia] - URGENCIA_PESO[b.urgencia] ||
      a.created_at.localeCompare(b.created_at),
  )
}

// Encerradas: a mais recentemente decidida primeiro.
export function ordenarEncerradas(lista: RequisicaoRow[]): RequisicaoRow[] {
  return [...lista].sort((a, b) => (b.decidido_em ?? b.updated_at).localeCompare(a.decidido_em ?? a.updated_at))
}

export function requisicaoFormError(input: { titulo: string }): string | null {
  if (!input.titulo.trim()) return 'Informe o que está sendo requisitado.'
  return null
}

// Espelha a RLS (requisicoes_update/delete): o dono mexe enquanto está
// pendente; depois que o Administrador decide, fica congelada. A permissão de
// verdade é o banco — isto só decide o que mostrar.
export function podeEditarRequisicao(profile: ProfileRow | null, r: RequisicaoRow): boolean {
  if (!profile) return false
  if (profile.role === 'administrador') return true
  return r.solicitante_id === profile.id && r.status === 'pendente'
}
