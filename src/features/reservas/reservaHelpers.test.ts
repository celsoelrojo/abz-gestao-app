import { describe, expect, it } from 'vitest'
import { buildHistoricoEntries, groupReservasByData, reservaFormError, reservaSlotStats } from './reservaHelpers'
import type { ReservaComoSlot } from './reservaHelpers'

function makeSlot(overrides: Partial<ReservaComoSlot>): ReservaComoSlot {
  return {
    id: '1',
    data: '2026-08-25',
    periodo: 'Almoço',
    horario: '12:00',
    quantidade_pessoas: 4,
    status: 'confirmada',
    ...overrides,
  }
}

describe('reservaSlotStats', () => {
  it('soma pessoas só das não canceladas, ordenadas por horário', () => {
    const reservas = [
      makeSlot({ id: '1', horario: '13:00', quantidade_pessoas: 2 }),
      makeSlot({ id: '2', horario: '12:00', quantidade_pessoas: 4 }),
      makeSlot({ id: '3', horario: '12:30', quantidade_pessoas: 10, status: 'cancelada' }),
    ]
    const stats = reservaSlotStats(reservas, '2026-08-25', 'Almoço')
    expect(stats.totalPessoas).toBe(6)
    expect(stats.quantidade).toBe(2)
    expect(stats.reservas.map((r) => r.id)).toEqual(['2', '1'])
  })

  it('exclui o id informado (edição de uma reserva existente)', () => {
    const reservas = [makeSlot({ id: '1' }), makeSlot({ id: '2' })]
    const stats = reservaSlotStats(reservas, '2026-08-25', 'Almoço', '1')
    expect(stats.reservas.map((r) => r.id)).toEqual(['2'])
  })

  it('conta pendentes e confirmadas separadamente', () => {
    const reservas = [
      makeSlot({ id: '1', status: 'pendente' }),
      makeSlot({ id: '2', status: 'confirmada' }),
      makeSlot({ id: '3', status: 'confirmada' }),
    ]
    const stats = reservaSlotStats(reservas, '2026-08-25', 'Almoço')
    expect(stats.pendentes).toBe(1)
    expect(stats.confirmadas).toBe(2)
  })

  it('ignora outra data/período', () => {
    const reservas = [makeSlot({ data: '2026-08-26' }), makeSlot({ periodo: 'Noite' })]
    expect(reservaSlotStats(reservas, '2026-08-25', 'Almoço').quantidade).toBe(0)
  })
})

describe('groupReservasByData', () => {
  it('agrupa por data ascendente, Almoço antes de Noite, horário ascendente', () => {
    const reservas = [
      { data: '2026-08-26', horario: '20:00', periodo: 'Noite' as const, id: 'a' },
      { data: '2026-08-25', horario: '13:00', periodo: 'Almoço' as const, id: 'b' },
      { data: '2026-08-25', horario: '20:00', periodo: 'Noite' as const, id: 'c' },
      { data: '2026-08-25', horario: '12:00', periodo: 'Almoço' as const, id: 'd' },
    ]
    const grupos = groupReservasByData(reservas)
    expect(grupos.map((g) => g.data)).toEqual(['2026-08-25', '2026-08-26'])
    expect(grupos[0].porPeriodo['Almoço'].map((r) => r.id)).toEqual(['d', 'b'])
    expect(grupos[0].porPeriodo['Noite'].map((r) => r.id)).toEqual(['c'])
  })
})

describe('reservaFormError', () => {
  const base = {
    nomeCliente: 'Ana',
    data: '2026-08-25',
    horario: '12:00',
    periodo: 'Almoço',
    quantidadePessoas: 2,
    status: 'pendente' as const,
    motivoCancelamento: '',
  }

  it('null quando tudo obrigatório está preenchido', () => {
    expect(reservaFormError(base)).toBeNull()
  })

  it('erro quando falta nome/data/horário/período/quantidade', () => {
    expect(reservaFormError({ ...base, nomeCliente: '' })).not.toBeNull()
    expect(reservaFormError({ ...base, quantidadePessoas: 0 })).not.toBeNull()
  })

  it('exige motivo do cancelamento quando status é cancelada', () => {
    expect(reservaFormError({ ...base, status: 'cancelada' })).toBe('Informe o motivo do cancelamento.')
    expect(reservaFormError({ ...base, status: 'cancelada', motivoCancelamento: 'Cliente desistiu' })).toBeNull()
  })
})

describe('buildHistoricoEntries', () => {
  it('vazio na criação (original null)', () => {
    expect(buildHistoricoEntries(null, { status: 'pendente', mesa: null, motivoCancelamento: null }, 'Ana', 'now')).toEqual([])
  })

  it('registra confirmação ao transicionar pra confirmada', () => {
    const entries = buildHistoricoEntries(
      { status: 'pendente', mesa: null },
      { status: 'confirmada', mesa: null, motivoCancelamento: null },
      'Ana',
      '2026-08-25T10:00:00',
    )
    expect(entries).toEqual([{ data: '2026-08-25T10:00:00', tipo: 'confirmacao', autor: 'Ana' }])
  })

  it('registra cancelamento com o motivo', () => {
    const entries = buildHistoricoEntries(
      { status: 'confirmada', mesa: null },
      { status: 'cancelada', mesa: null, motivoCancelamento: 'Cliente desistiu' },
      'Ana',
      'now',
    )
    expect(entries).toEqual([{ data: 'now', tipo: 'cancelamento', autor: 'Ana', detalhe: 'Cliente desistiu' }])
  })

  it('registra mudança de mesa', () => {
    const entries = buildHistoricoEntries(
      { status: 'confirmada', mesa: '5' },
      { status: 'confirmada', mesa: '8', motivoCancelamento: null },
      'Ana',
      'now',
    )
    expect(entries).toEqual([{ data: 'now', tipo: 'mudanca_mesa', autor: 'Ana', detalhe: '5 → 8' }])
  })

  it('não registra nada numa edição comum sem transição relevante', () => {
    const entries = buildHistoricoEntries(
      { status: 'confirmada', mesa: '5' },
      { status: 'confirmada', mesa: '5', motivoCancelamento: null },
      'Ana',
      'now',
    )
    expect(entries).toEqual([])
  })
})
