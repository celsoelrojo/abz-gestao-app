import { describe, expect, it } from 'vitest'
import { findOverdueInfo, getUpcomingDays, getWeekDates, isTaskScheduledOn } from './scheduling'
import { isoDate } from '../../lib/date'
import type { ChecklistTaskRow } from '../../types/database'

const ALL_WEEKDAYS: ChecklistTaskRow['dias'] = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']

function makeTask(overrides: Partial<ChecklistTaskRow>): ChecklistTaskRow {
  return {
    id: 1,
    setor: 'Bar',
    title: 'Tarefa de teste',
    description: '',
    responsavel_nome: 'Fulano',
    responsavel_id: null,
    turno: null,
    periodicidade: 'Diária',
    dias: ALL_WEEKDAYS,
    data_unica: null,
    semanas_do_mes: [],
    vinculo_tipo: null,
    vinculo_id: null,
    envolve_producao: false,
    producao_vinculada_id: null,
    foto_obrigatoria: false,
    freelancer_pagamento: false,
    freelancer_escala_id: null,
    active: true,
    posicao: 0,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

function d(iso: string): Date {
  return new Date(`${iso}T00:00:00`)
}

describe('isTaskScheduledOn', () => {
  it('tarefa Diária (com os 7 dias marcados) aparece em qualquer dia', () => {
    const task = makeTask({ periodicidade: 'Diária' })
    expect(isTaskScheduledOn(task, d('2026-08-25'))).toBe(true) // Terça
    expect(isTaskScheduledOn(task, d('2026-08-30'))).toBe(true) // Domingo
  })

  it('tarefa "A cada turno" segue a mesma regra de dias que Diária', () => {
    const task = makeTask({ periodicidade: 'A cada turno' })
    expect(isTaskScheduledOn(task, d('2026-08-25'))).toBe(true)
  })

  it('tarefa Semanal só aparece nos dias configurados', () => {
    const task = makeTask({ periodicidade: 'Semanal', dias: ['Segunda'] })
    expect(isTaskScheduledOn(task, d('2026-08-24'))).toBe(true) // Segunda
    expect(isTaskScheduledOn(task, d('2026-08-25'))).toBe(false) // Terça
  })

  it('tarefa Única só aparece na data_unica exata, ignorando dias', () => {
    const task = makeTask({ periodicidade: 'Única', dias: [], data_unica: '2026-09-01' })
    expect(isTaskScheduledOn(task, d('2026-09-01'))).toBe(true) // Terça
    expect(isTaskScheduledOn(task, d('2026-09-02'))).toBe(false)
  })

  it('tarefa inativa nunca aparece, mesmo que o dia bata', () => {
    const task = makeTask({ periodicidade: 'Diária', active: false })
    expect(isTaskScheduledOn(task, d('2026-08-25'))).toBe(false)
  })

  it('Mensal exige o dia da semana E a semana do mês configurados (ex.: 1ª segunda)', () => {
    const task = makeTask({ periodicidade: 'Mensal', dias: ['Segunda'], semanas_do_mes: ['1'] })
    expect(isTaskScheduledOn(task, d('2026-08-03'))).toBe(true) // 1ª segunda de agosto/2026
    expect(isTaskScheduledOn(task, d('2026-08-10'))).toBe(false) // 2ª segunda
    expect(isTaskScheduledOn(task, d('2026-08-04'))).toBe(false) // terça, dia errado da semana
  })

  it('Quinzenal aceita duas semanas do mês (ex.: 1ª e 3ª segunda)', () => {
    const task = makeTask({ periodicidade: 'Quinzenal', dias: ['Segunda'], semanas_do_mes: ['1', '3'] })
    expect(isTaskScheduledOn(task, d('2026-08-03'))).toBe(true) // 1ª
    expect(isTaskScheduledOn(task, d('2026-08-17'))).toBe(true) // 3ª
    expect(isTaskScheduledOn(task, d('2026-08-10'))).toBe(false) // 2ª
  })

  it('"última semana" bate na última ocorrência daquele dia da semana, não no 5º bloco de 7 dias', () => {
    const task = makeTask({ periodicidade: 'Mensal', dias: ['Segunda'], semanas_do_mes: ['ultima'] })
    // Agosto/2026: segundas em 3, 10, 17, 24, 31 — a última é dia 31.
    expect(isTaskScheduledOn(task, d('2026-08-24'))).toBe(false)
    expect(isTaskScheduledOn(task, d('2026-08-31'))).toBe(true)
  })
})

describe('getWeekDates', () => {
  it('retorna Segunda a Domingo contendo a data base, mesmo se a base for domingo', () => {
    const week = getWeekDates(d('2026-08-30')) // Domingo
    expect(week.map(isoDate)).toEqual([
      '2026-08-24',
      '2026-08-25',
      '2026-08-26',
      '2026-08-27',
      '2026-08-28',
      '2026-08-29',
      '2026-08-30',
    ])
  })
})

describe('getUpcomingDays', () => {
  it('começa amanhã e cruza virada de mês', () => {
    const days = getUpcomingDays(5, d('2026-08-29'))
    expect(days.map(isoDate)).toEqual([
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
    ])
  })
})

describe('findOverdueInfo', () => {
  it('não acusa atraso quando a tarefa já foi concluída hoje', () => {
    const task = makeTask({ periodicidade: 'Diária' })
    const week = getWeekDates(d('2026-08-27')) // Quinta
    const info = findOverdueInfo(task, week, d('2026-08-27'), ['2026-08-27'])
    expect(info).toBeNull()
  })

  it('acusa a ocorrência mais antiga não concluída desde segunda-feira', () => {
    const task = makeTask({ periodicidade: 'Semanal', dias: ['Segunda'] })
    const week = getWeekDates(d('2026-08-27')) // Quinta, semana de 24-30/08
    const info = findOverdueInfo(task, week, d('2026-08-27'), [])
    expect(info).toEqual({ missedDate: '2026-08-24', daysLate: 3 })
  })

  it('uma conclusão recente avança o cursor e evita reacusar dias já cobertos', () => {
    const task = makeTask({ periodicidade: 'Diária' })
    const week = getWeekDates(d('2026-08-27')) // semana de 24-30/08
    // Concluída terça (25) — segunda (24) fica pra trás do cursor, então não conta.
    const info = findOverdueInfo(task, week, d('2026-08-27'), ['2026-08-25'])
    expect(info).toEqual({ missedDate: '2026-08-26', daysLate: 1 })
  })

  it('atraso da semana passada não aparece mais depois que a semana vira', () => {
    const task = makeTask({ periodicidade: 'Semanal', dias: ['Segunda'] })
    // Segunda-feira seguinte — a semana atual começa nela mesma, então o
    // gap da segunda anterior (não concluída) já não entra na busca.
    const week = getWeekDates(d('2026-08-31'))
    const info = findOverdueInfo(task, week, d('2026-08-31'), [])
    expect(info).toBeNull()
  })

  it('tarefa inativa nunca acusa atraso', () => {
    const task = makeTask({ periodicidade: 'Diária', active: false })
    const week = getWeekDates(d('2026-08-27'))
    expect(findOverdueInfo(task, week, d('2026-08-27'), [])).toBeNull()
  })
})
