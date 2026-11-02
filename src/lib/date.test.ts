import { describe, expect, it } from 'vitest'
import { diaOperacional, formatDateBR, isoDate, weekdayNameForDate } from './date'

describe('diaOperacional', () => {
  it('antes das 5h ainda é o dia anterior (fechamento de madrugada)', () => {
    expect(isoDate(diaOperacional(new Date(2026, 10, 3, 0, 0)))).toBe('2026-11-02')
    expect(isoDate(diaOperacional(new Date(2026, 10, 3, 2, 30)))).toBe('2026-11-02')
    expect(isoDate(diaOperacional(new Date(2026, 10, 3, 4, 59)))).toBe('2026-11-02')
  })

  it('às 5h em diante já é o dia do calendário', () => {
    expect(isoDate(diaOperacional(new Date(2026, 10, 3, 5, 0)))).toBe('2026-11-03')
    expect(isoDate(diaOperacional(new Date(2026, 10, 3, 23, 59)))).toBe('2026-11-03')
  })

  it('cruza virada de mês e de ano', () => {
    expect(isoDate(diaOperacional(new Date(2026, 11, 1, 1, 0)))).toBe('2026-11-30')
    expect(isoDate(diaOperacional(new Date(2027, 0, 1, 3, 0)))).toBe('2026-12-31')
  })

  it('devolve sempre meia-noite, pra dar dias de atraso exatos', () => {
    const d = diaOperacional(new Date(2026, 10, 3, 14, 37))
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([0, 0, 0])
  })
})

describe('isoDate', () => {
  it('formata em YYYY-MM-DD usando o horário local (não UTC)', () => {
    expect(isoDate(new Date(2026, 7, 25))).toBe('2026-08-25') // mês 7 = agosto (0-index)
  })

  it('preenche dia/mês com zero à esquerda', () => {
    expect(isoDate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('weekdayNameForDate', () => {
  it('retorna o nome do dia da semana em português', () => {
    // 25/08/2026 é uma terça-feira.
    expect(weekdayNameForDate(new Date(2026, 7, 25))).toBe('Terça')
  })
})

describe('formatDateBR', () => {
  it('converte YYYY-MM-DD para DD/MM/YYYY', () => {
    expect(formatDateBR('2026-08-25')).toBe('25/08/2026')
  })

  it('retorna string vazia para valor nulo/ausente', () => {
    expect(formatDateBR(null)).toBe('')
    expect(formatDateBR(undefined)).toBe('')
  })
})
