import { describe, expect, it } from 'vitest'
import {
  agruparPorCampo,
  estoqueItemCritico,
  estoqueQuantidadeLabel,
  formatValidadeRotulo,
  ordenarPorTitulo,
  precisaComprar,
  sugestaoCompra,
  validadeInfo,
  validadeProxima,
} from './estoqueHelpers'

describe('estoqueQuantidadeLabel', () => {
  it('formata litro/mililitro/quilo/grama com sufixo colado', () => {
    expect(estoqueQuantidadeLabel(5, 'Litro')).toBe('5L')
    expect(estoqueQuantidadeLabel(200, 'Mililitro')).toBe('200ml')
    expect(estoqueQuantidadeLabel(8, 'Quilo')).toBe('8kg')
    expect(estoqueQuantidadeLabel(500, 'Grama')).toBe('500g')
  })

  it('pluraliza caixa/pacote/fardo corretamente', () => {
    expect(estoqueQuantidadeLabel(1, 'Caixa')).toBe('1 caixa')
    expect(estoqueQuantidadeLabel(3, 'Caixa')).toBe('3 caixas')
    expect(estoqueQuantidadeLabel(1, 'Pacote')).toBe('1 pacote')
    expect(estoqueQuantidadeLabel(2, 'Fardo')).toBe('2 fardos')
  })

  it('cai no genérico "unidades" pra Unidade', () => {
    expect(estoqueQuantidadeLabel(10, 'Unidade')).toBe('10 unidades')
  })
})

describe('estoqueItemCritico', () => {
  it('true quando quantidade <= min', () => {
    expect(estoqueItemCritico({ min: 10, quantidade: 10 })).toBe(true)
    expect(estoqueItemCritico({ min: 10, quantidade: 5 })).toBe(true)
  })
  it('false quando quantidade > min', () => {
    expect(estoqueItemCritico({ min: 10, quantidade: 11 })).toBe(false)
  })
  it('false quando min não configurado', () => {
    expect(estoqueItemCritico({ min: null, quantidade: 0 })).toBe(false)
  })
})

describe('precisaComprar / sugestaoCompra', () => {
  it('precisaComprar é estrito (< não <=)', () => {
    expect(precisaComprar({ medio: 10, quantidade: 10 })).toBe(false)
    expect(precisaComprar({ medio: 10, quantidade: 9 })).toBe(true)
  })
  it('false quando medio não configurado', () => {
    expect(precisaComprar({ medio: null, quantidade: 0 })).toBe(false)
  })
  it('sugestaoCompra mira 80% do máximo, não o médio', () => {
    expect(sugestaoCompra({ max: 20, quantidade: 4 })).toBe(12) // 80% de 20 = 16; 16 - 4 = 12
  })
  it('sugestaoCompra nunca fica negativa', () => {
    expect(sugestaoCompra({ max: 20, quantidade: 18 })).toBe(0) // 80% de 20 = 16 < 18
  })
  it('sugestaoCompra é null sem máximo configurado', () => {
    expect(sugestaoCompra({ max: null, quantidade: 4 })).toBeNull()
  })
})

describe('validadeInfo / formatValidadeRotulo', () => {
  it('já vencido', () => {
    const info = validadeInfo('2026-08-20', '2026-08-25')
    expect(info.dias).toBe(-5)
    expect(formatValidadeRotulo(info)).toBe('vencido')
  })
  it('vence hoje', () => {
    const info = validadeInfo('2026-08-25', '2026-08-25')
    expect(formatValidadeRotulo(info)).toBe('vence hoje')
  })
  it('vence em N dias (singular/plural)', () => {
    expect(formatValidadeRotulo(validadeInfo('2026-08-26', '2026-08-25'))).toBe('vence em 1 dia')
    expect(formatValidadeRotulo(validadeInfo('2026-08-30', '2026-08-25'))).toBe('vence em 5 dias')
  })
})

describe('validadeProxima', () => {
  it('true quando faltam 7 dias ou menos e há saldo', () => {
    expect(validadeProxima({ validade: '2026-09-01', quantidade: 3 }, '2026-08-25')).toBe(true)
  })
  it('false quando falta mais de 7 dias', () => {
    expect(validadeProxima({ validade: '2026-09-05', quantidade: 3 }, '2026-08-25')).toBe(false)
  })
  it('false sem validade ou sem saldo', () => {
    expect(validadeProxima({ validade: null, quantidade: 3 }, '2026-08-25')).toBe(false)
    expect(validadeProxima({ validade: '2026-08-26', quantidade: 0 }, '2026-08-25')).toBe(false)
  })
})

describe('agruparPorCampo', () => {
  it('agrupa em ordem alfabética, sem-valor por último', () => {
    const items = [
      { title: 'Vodka', produto_categoria: 'Bebidas' },
      { title: 'Cerveja', produto_categoria: 'Bebidas' },
      { title: 'Sal', produto_categoria: null },
      { title: 'Arroz', produto_categoria: 'Cereais' },
    ]
    const groups = agruparPorCampo(items, (i) => i.produto_categoria, 'Sem categoria')
    expect(groups.map((g) => g.chave)).toEqual(['Bebidas', 'Cereais', 'Sem categoria'])
    expect(groups[0].itens.map((i) => i.title)).toEqual(['Vodka', 'Cerveja'])
    expect(groups[2].itens.map((i) => i.title)).toEqual(['Sal'])
  })
})

describe('ordenarPorTitulo', () => {
  it('ordena por título em pt-BR, sem mutar o array original', () => {
    const items = [{ title: 'Vodka' }, { title: 'Cerveja' }, { title: 'Água' }]
    const sorted = ordenarPorTitulo(items)
    expect(sorted.map((i) => i.title)).toEqual(['Água', 'Cerveja', 'Vodka'])
    expect(items.map((i) => i.title)).toEqual(['Vodka', 'Cerveja', 'Água'])
  })
})
