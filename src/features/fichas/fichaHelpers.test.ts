import { describe, expect, it } from 'vitest'
import {
  calcFichaCustos,
  calcIngredienteCustoTotal,
  calcIngredienteCustoUnitario,
  calcValidadeDateTime,
  calcularProducaoEscalada,
  gerarNumeroLote,
} from './fichaHelpers'

describe('calcIngredienteCustoUnitario', () => {
  it('divide preçoBase por qtdBase', () => {
    expect(calcIngredienteCustoUnitario({ qtdBase: 1000, precoBase: 50 })).toBe(0.05)
  })
  it('zero quando qtdBase é zero ou ausente', () => {
    expect(calcIngredienteCustoUnitario({ qtdBase: 0, precoBase: 50 })).toBe(0)
    expect(calcIngredienteCustoUnitario({ qtdBase: null, precoBase: 50 })).toBe(0)
  })
})

describe('calcIngredienteCustoTotal', () => {
  it('usa qtdBruta, nunca qtdLiquida', () => {
    const ing = { qtdBase: 1000, precoBase: 50, qtdBruta: 200 }
    expect(calcIngredienteCustoTotal(ing)).toBe(10) // 0.05 * 200
  })
})

describe('calcFichaCustos', () => {
  it('soma custo dos ingredientes + embalagem', () => {
    const ingredientes = [
      { qtdBase: 1000, precoBase: 50, qtdBruta: 200 }, // custo 10
      { qtdBase: 100, precoBase: 10, qtdBruta: 50 }, // custo 5
    ]
    const custos = calcFichaCustos(ingredientes, 2, null)
    expect(custos.custoTotalReceita).toBe(17) // 10 + 5 + 2
  })

  it('lucro/margem null quando preço sugerido é zero ou ausente', () => {
    const custos = calcFichaCustos([{ qtdBase: 1000, precoBase: 50, qtdBruta: 200 }], 0, null)
    expect(custos.lucroBruto).toBeNull()
    expect(custos.margemEstimada).toBeNull()
  })

  it('calcula lucro e margem quando há preço sugerido', () => {
    const custos = calcFichaCustos([{ qtdBase: 1000, precoBase: 50, qtdBruta: 200 }], 0, 20)
    expect(custos.custoTotalReceita).toBe(10)
    expect(custos.lucroBruto).toBe(10)
    expect(custos.margemEstimada).toBe(50)
  })
})

describe('calcValidadeDateTime', () => {
  it('soma horas/dias/semanas/meses corretamente', () => {
    const base = '2026-08-25T12:00:00'
    expect(calcValidadeDateTime(base, 5, 'Horas')?.getHours()).toBe(17)
    expect(calcValidadeDateTime(base, 3, 'Dias')?.getDate()).toBe(28)
    expect(calcValidadeDateTime(base, 1, 'Semanas')?.getDate()).toBe(1) // 25+7 = 1 setembro
    expect(calcValidadeDateTime(base, 1, 'Meses')?.getMonth()).toBe(8) // setembro (0-indexed)
  })

  it('null quando falta qualquer parâmetro', () => {
    expect(calcValidadeDateTime(null, 5, 'Horas')).toBeNull()
    expect(calcValidadeDateTime('2026-08-25T12:00:00', null, 'Horas')).toBeNull()
    expect(calcValidadeDateTime('2026-08-25T12:00:00', 5, null)).toBeNull()
    expect(calcValidadeDateTime('2026-08-25T12:00:00', 0, 'Horas')).toBeNull()
  })
})

describe('calcularProducaoEscalada', () => {
  it('escala os demais ingredientes e o rendimento pela razão do ingrediente base', () => {
    const ingredientes = [
      { id: 'base', qtdLotePadrao: 1000 },
      { id: 'sec', qtdLotePadrao: 200 },
    ]
    const resultado = calcularProducaoEscalada(ingredientes, 'base', 2000, 40)
    expect(resultado?.ratio).toBe(2)
    expect(resultado?.quantidades['sec']).toBe(400)
    expect(resultado?.rendimentoAjustado).toBe(80)
  })

  it('null quando o ingrediente base não tem qtdLotePadrao configurada', () => {
    const ingredientes = [{ id: 'base', qtdLotePadrao: null }]
    expect(calcularProducaoEscalada(ingredientes, 'base', 100, 10)).toBeNull()
  })
})

describe('gerarNumeroLote', () => {
  it('usa o código quando presente, maiúsculo e só alfanumérico', () => {
    expect(gerarNumeroLote('Caldo de Carne', 'cb-01', new Date(2026, 7, 17), 1)).toBe('CB01-1708-001')
  })

  it('cai pras 3 primeiras letras do nome quando não há código', () => {
    expect(gerarNumeroLote('Xarope de Gengibre', null, new Date(2026, 7, 17), 3)).toBe('XAR-1708-003')
  })
})
