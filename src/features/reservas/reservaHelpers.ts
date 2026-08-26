import type { ReservaHistoricoEntry, ReservaPeriodo, ReservaStatus } from '../../types/database'

export interface ReservaComoSlot {
  id: string
  data: string
  periodo: ReservaPeriodo
  horario: string | null
  quantidade_pessoas: number
  status: ReservaStatus
}

export interface ReservaSlotStats<T> {
  reservas: T[]
  quantidade: number
  totalPessoas: number
  pendentes: number
  confirmadas: number
}

// Espelha reservaSlotStats() do protótipo (script.js:9839-9848) — só conta
// reservas não canceladas, ordenadas por horário.
export function reservaSlotStats<T extends ReservaComoSlot>(
  reservas: T[],
  dataIso: string,
  periodo: ReservaPeriodo,
  excludeId?: string,
): ReservaSlotStats<T> {
  const list = reservas
    .filter((r) => r.data === dataIso && r.periodo === periodo && r.id !== excludeId && r.status !== 'cancelada')
    .sort((a, b) => (a.horario ?? '').localeCompare(b.horario ?? ''))
  const totalPessoas = list.reduce((sum, r) => sum + (Number(r.quantidade_pessoas) || 0), 0)
  return {
    reservas: list,
    quantidade: list.length,
    totalPessoas,
    pendentes: list.filter((r) => r.status === 'pendente').length,
    confirmadas: list.filter((r) => r.status === 'confirmada').length,
  }
}

export interface ReservaGrupoData<T> {
  data: string
  porPeriodo: Record<ReservaPeriodo, T[]>
}

// Agrupa por data (ordem ascendente) e, dentro de cada data, por período —
// Almoço sempre antes de Noite, mesma ordem de RESERVA_PERIODOS no
// protótipo. Reservas dentro do mesmo período vêm ordenadas por horário.
export function groupReservasByData<T extends { data: string; horario: string | null; periodo: ReservaPeriodo }>(
  reservas: T[],
): ReservaGrupoData<T>[] {
  const sorted = [...reservas].sort(
    (a, b) => a.data.localeCompare(b.data) || (a.horario ?? '').localeCompare(b.horario ?? ''),
  )
  const porData = new Map<string, Record<ReservaPeriodo, T[]>>()
  sorted.forEach((r) => {
    if (!porData.has(r.data)) porData.set(r.data, { Almoço: [], Noite: [] })
    porData.get(r.data)![r.periodo].push(r)
  })
  return [...porData.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([data, porPeriodo]) => ({ data, porPeriodo }))
}

// Espelha a validação de saveReserva (script.js:10244-10254).
export function reservaFormError(d: {
  nomeCliente: string
  data: string
  horario: string
  periodo: string
  quantidadePessoas: number
  status: ReservaStatus
  motivoCancelamento: string
}): string | null {
  if (!d.nomeCliente.trim() || !d.data || !d.horario || !d.periodo || !(d.quantidadePessoas > 0)) {
    return 'Preencha nome, data, horário, período e quantidade de pessoas.'
  }
  if (d.status === 'cancelada' && !d.motivoCancelamento.trim()) {
    return 'Informe o motivo do cancelamento.'
  }
  return null
}

// Espelha os pushes de histórico em saveReserva (script.js:10259-10278) — só
// confirmação, cancelamento e mudança de mesa geram entrada; edição comum
// não gera nada (mesmo comportamento do protótipo, mesmo havendo um rótulo
// "Edição" nunca usado nesse trecho).
export function buildHistoricoEntries(
  original: { status: ReservaStatus; mesa: string | null } | null,
  atualizado: { status: ReservaStatus; mesa: string | null; motivoCancelamento: string | null },
  autor: string,
  nowIso: string,
): ReservaHistoricoEntry[] {
  if (!original) return []
  const entries: ReservaHistoricoEntry[] = []
  if (original.status !== 'confirmada' && atualizado.status === 'confirmada') {
    entries.push({ data: nowIso, tipo: 'confirmacao', autor })
  }
  if (original.status !== 'cancelada' && atualizado.status === 'cancelada') {
    entries.push({ data: nowIso, tipo: 'cancelamento', autor, detalhe: atualizado.motivoCancelamento })
  }
  if ((original.mesa ?? '') !== (atualizado.mesa ?? '')) {
    entries.push({
      data: nowIso,
      tipo: 'mudanca_mesa',
      autor,
      detalhe: `${original.mesa || '—'} → ${atualizado.mesa || '—'}`,
    })
  }
  return entries
}
