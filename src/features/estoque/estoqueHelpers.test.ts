import { describe, expect, it } from 'vitest'
import {
  agruparPorCampo,
  estoqueItemCritico,
  estoqueQuantidadeLabel,
  formatValidadeRotulo,
  ordenarPorTitulo,
  embalagensPorUnidadesSoltas,
  podeMexerEmUnidadesSoltas,
  precisaComprar,
  rotuloSaldoEmbalagem,
  saldoEmbalagemESoltas,
  subcategoriasDaCategoria,
  sugestaoCompra,
  validadeInfo,
  validadeProxima,
} from './estoqueHelpers'
import type { TaxonomiaRow } from '../../types/database'

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
  it('sugestaoCompra arredonda pra cima, sem inventar +1 por erro de ponto flutuante', () => {
    expect(sugestaoCompra({ max: 10, quantidade: 2.5 })).toBe(6) // 8 - 2,5 = 5,5 -> 6
    expect(sugestaoCompra({ max: 15, quantidade: 0 })).toBe(12) // 0,8 × 15 = 12 exato (não 13)
    expect(sugestaoCompra({ max: 12, quantidade: 0.3 })).toBe(10) // 9,6 - 0,3 = 9,3 -> 10
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

describe('subcategoriasDaCategoria', () => {
  const tax = (over: Partial<TaxonomiaRow>): TaxonomiaRow => ({
    id: Math.random().toString(36).slice(2),
    modulo: 'estoque',
    setor: 'Bar',
    tipo: 'subcategoria',
    valor: 'x',
    categoria_pai: null,
    ...over,
  })
  const dados: TaxonomiaRow[] = [
    tax({ valor: 'Destilada', categoria_pai: 'Bebidas alcoólicas' }),
    tax({ valor: 'Amari', categoria_pai: 'Bebidas alcoólicas' }),
    tax({ valor: 'Licores', categoria_pai: 'Bebidas alcoólicas' }),
    tax({ valor: 'Refrigerante', categoria_pai: 'Soft' }),
    tax({ valor: 'Órfã', categoria_pai: null }),
    tax({ valor: 'Bebidas alcoólicas', tipo: 'categoria', categoria_pai: null }),
    tax({ valor: 'Vinhos', categoria_pai: 'Bebidas alcoólicas', setor: 'Cozinha' }),
  ]

  it('devolve só as subcategorias ligadas à categoria escolhida, em ordem pt-BR', () => {
    expect(subcategoriasDaCategoria(dados, 'Bar', 'Bebidas alcoólicas')).toEqual(['Amari', 'Destilada', 'Licores'])
  })

  it('respeita o setor', () => {
    expect(subcategoriasDaCategoria(dados, 'Cozinha', 'Bebidas alcoólicas')).toEqual(['Vinhos'])
  })

  it('sem categoria escolhida, devolve as ainda não vinculadas (categoria_pai null)', () => {
    expect(subcategoriasDaCategoria(dados, 'Bar', '')).toEqual(['Órfã'])
  })

  it('categoria sem subcategorias vinculadas devolve lista vazia', () => {
    expect(subcategoriasDaCategoria(dados, 'Bar', 'Frutas')).toEqual([])
  })
})

describe('unidades soltas de pacote/fardo', () => {
  const fardo = (quantidade: number, upe: number | null = 12) => ({ quantidade, unidade: 'Fardo' as const, unidades_por_embalagem: upe })

  it('só vale pra embalagem com unidades por embalagem configurada', () => {
    expect(podeMexerEmUnidadesSoltas(fardo(2))).toBe(true)
    expect(podeMexerEmUnidadesSoltas(fardo(2, null))).toBe(false)
    expect(podeMexerEmUnidadesSoltas({ unidade: 'Litro', unidades_por_embalagem: 12 })).toBe(false)
  })

  it('saldo em embalagens + soltas, reconstruído sem erro de arredondamento', () => {
    expect(saldoEmbalagemESoltas(fardo(3.333))).toEqual({ embalagens: 3, soltas: 4, totalUnidades: 40 }) // 3,333 × 12 = 39,996 -> 40
    expect(saldoEmbalagemESoltas(fardo(0.083))).toEqual({ embalagens: 0, soltas: 1, totalUnidades: 1 })
    expect(saldoEmbalagemESoltas({ quantidade: 1, unidade: 'Unidade', unidades_por_embalagem: null })).toBeNull()
  })

  it('tirar unidades soltas: 2 de 3 fardos de 12', () => {
    const delta = embalagensPorUnidadesSoltas(fardo(3), 2, -1)
    expect(delta).toBe(0.167)
    expect(3 - (delta as number)).toBe(2.833) // 34 unidades de 36
  })

  it('12 retiradas de 1 unidade não deixam resto (sem deriva)', () => {
    let q = 3
    for (let i = 0; i < 12; i++) q = Math.round((q - (embalagensPorUnidadesSoltas(fardo(q), 1, -1) as number)) * 1000) / 1000
    expect(q).toBe(2) // exatamente 24 unidades
    expect(saldoEmbalagemESoltas(fardo(q))?.totalUnidades).toBe(24)
  })

  it('somar unidades soltas', () => {
    expect(embalagensPorUnidadesSoltas(fardo(2), 5, 1)).toBe(0.417) // 24 + 5 = 29 -> 2,417
    expect(embalagensPorUnidadesSoltas(fardo(2), 12, 1)).toBe(1)
  })

  it('recusa unidade quebrada, zero e retirada maior que o saldo', () => {
    expect(embalagensPorUnidadesSoltas(fardo(2), 1.5, 1)).toBeNull()
    expect(embalagensPorUnidadesSoltas(fardo(2), 0, 1)).toBeNull()
    expect(embalagensPorUnidadesSoltas(fardo(2), 25, -1)).toBeNull() // só há 24
    expect(embalagensPorUnidadesSoltas(fardo(2), 24, -1)).toBe(2)
  })

  it('rótulo do saldo', () => {
    expect(rotuloSaldoEmbalagem(fardo(3.333))).toBe('3 fardos e 4 un (40 unidades)')
    expect(rotuloSaldoEmbalagem(fardo(1))).toBe('1 fardo (12 unidades)')
    expect(rotuloSaldoEmbalagem(fardo(1, null))).toBeNull()
  })
})
