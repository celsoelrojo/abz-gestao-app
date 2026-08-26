import { describe, expect, it } from 'vitest'
import { formatDateBR, isoDate, weekdayNameForDate } from './date'

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
