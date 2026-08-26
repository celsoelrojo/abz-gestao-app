import { describe, expect, it } from 'vitest'
import { estoqueCriticoTexto, estoqueValidadeTexto, freelancersResumoTexto, reservasResumoTexto } from './mensagensHelpers'

describe('reservasResumoTexto', () => {
  it('null quando não há reservas em nenhum período', () => {
    expect(reservasResumoTexto(0, 0)).toBeNull()
  })
  it('só almoço', () => {
    expect(reservasResumoTexto(5, 0)).toBe('Hoje teremos 5 pessoas reservadas para o almoço conosco.')
  })
  it('singular quando é 1 pessoa', () => {
    expect(reservasResumoTexto(1, 0)).toBe('Hoje teremos 1 pessoa reservada para o almoço conosco.')
  })
  it('só noite', () => {
    expect(reservasResumoTexto(0, 8)).toBe('Hoje teremos 8 pessoas reservadas para a noite conosco.')
  })
  it('almoço e noite juntos', () => {
    expect(reservasResumoTexto(5, 8)).toBe('Hoje teremos 5 pessoas reservadas para o almoço e 8 para a noite conosco.')
  })
})

describe('freelancersResumoTexto', () => {
  it('null quando não há freelancers em nenhum período', () => {
    expect(freelancersResumoTexto(0, 0)).toBeNull()
  })
  it('formata os dois períodos', () => {
    expect(freelancersResumoTexto(2, 1)).toBe('Freelancers no Almoço: 2. Freelancers na Noite: 1.')
  })
})

describe('estoqueCriticoTexto', () => {
  it('null sem itens críticos', () => {
    expect(estoqueCriticoTexto([])).toBeNull()
  })
  it('singular com 1 item', () => {
    expect(estoqueCriticoTexto(['Gin'])).toBe('Estoque crítico: "Gin" atingiu o estoque mínimo.')
  })
  it('plural com vários itens, listados', () => {
    expect(estoqueCriticoTexto(['Gin', 'Vodka'])).toBe('Estoque crítico: 2 itens atingiram o estoque mínimo (Gin, Vodka).')
  })
})

describe('estoqueValidadeTexto', () => {
  it('null sem itens próximos', () => {
    expect(estoqueValidadeTexto([], '2026-08-25')).toBeNull()
  })
  it('singular, já vencido', () => {
    expect(estoqueValidadeTexto([{ title: 'Frango', validade: '2026-08-20' }], '2026-08-25')).toBe(
      'Validade próxima: "Frango" vencido.',
    )
  })
  it('plural, com rótulos individuais', () => {
    const texto = estoqueValidadeTexto(
      [
        { title: 'Frango', validade: '2026-08-25' },
        { title: 'Leite', validade: '2026-08-26' },
      ],
      '2026-08-25',
    )
    expect(texto).toBe('Validade próxima: 2 itens perto do vencimento — Frango (vence hoje), Leite (vence em 1 dia).')
  })
})
