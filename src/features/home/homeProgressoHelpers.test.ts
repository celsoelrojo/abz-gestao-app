import { describe, expect, it } from 'vitest'
import { calcularProgresso } from './homeProgressoHelpers'

describe('calcularProgresso', () => {
  it('sem tarefas: 0%, sem frase de incentivo', () => {
    const info = calcularProgresso({ total: 0, feitas: 0 }, true)
    expect(info.pct).toBe(0)
    expect(info.restantes).toBe(0)
    expect(info.mostrarFraseIncentivo).toBe(false)
  })

  it('1 de 10 (10% feito, 90% faltando): não mostra frase', () => {
    const info = calcularProgresso({ total: 10, feitas: 1 }, true)
    expect(info.pct).toBe(10)
    expect(info.mostrarFraseIncentivo).toBe(false)
  })

  it('faltando exatamente 15%: mostra frase (limite inclusivo)', () => {
    const info = calcularProgresso({ total: 20, feitas: 17 }, true)
    expect(info.pct).toBe(85)
    expect(info.restantes).toBe(3)
    expect(info.mostrarFraseIncentivo).toBe(true)
  })

  it('faltando 20%: não mostra frase (acima do limite)', () => {
    const info = calcularProgresso({ total: 10, feitas: 8 }, true)
    expect(info.mostrarFraseIncentivo).toBe(false)
  })

  it('faltando 10%: mostra frase', () => {
    const info = calcularProgresso({ total: 10, feitas: 9 }, true)
    expect(info.pct).toBe(90)
    expect(info.mostrarFraseIncentivo).toBe(true)
  })

  it('100% concluído: não mostra frase (nada faltando)', () => {
    const info = calcularProgresso({ total: 10, feitas: 10 }, true)
    expect(info.pct).toBe(100)
    expect(info.restantes).toBe(0)
    expect(info.mostrarFraseIncentivo).toBe(false)
  })

  it('permitirFraseIncentivo=false nunca mostra, mesmo perto do fim', () => {
    const info = calcularProgresso({ total: 10, feitas: 9 }, false)
    expect(info.mostrarFraseIncentivo).toBe(false)
  })
})
