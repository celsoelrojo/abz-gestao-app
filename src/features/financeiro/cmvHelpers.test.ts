import { describe, expect, it } from 'vitest'
import {
  calcularCmv,
  formatPercent,
  itemContaNoCmv,
  listarDias,
  mesDe,
  momentoFinal,
  momentoInicial,
  periodoDoPreset,
  semanaDe,
  somarCompras,
  somarFaturamento,
  valorizarEstoque,
  type ItemEstoqueCmv,
} from './cmvHelpers'
import { parseValorBR } from './contaHelpers'
import type { ContaPagarRow } from '../../types/database'

function conta(p: Partial<ContaPagarRow>): ContaPagarRow {
  return {
    id: 'c',
    descricao: 'Compra',
    fornecedor: null,
    categoria: 'Mercadoria – Bebidas',
    valor: 100,
    vencimento: '2026-11-10',
    observacoes: null,
    numero_nota: null,
    chave_acesso: null,
    fornecedor_cnpj: null,
    nota_foto_path: null,
    itens_nota: null,
    grupo_id: null,
    parcela: null,
    parcelas: null,
    pago_em: null,
    valor_pago: null,
    forma_pagamento: null,
    data_compra: null,
    criado_por: null,
    created_at: '',
    updated_at: '',
    ...p,
  }
}

function item(p: Partial<ItemEstoqueCmv> & { id: string }): ItemEstoqueCmv {
  return { title: p.id, unidade: 'Unidade', categoria: 'Bar', tipo_produto: 'Matéria Prima', ...p }
}

describe('períodos', () => {
  it('semana vai de segunda a domingo, de qualquer dia dela', () => {
    // 04/11/2026 é quarta-feira.
    expect(semanaDe('2026-11-04')).toEqual({ inicio: '2026-11-02', fim: '2026-11-08' })
    expect(semanaDe('2026-11-02')).toEqual({ inicio: '2026-11-02', fim: '2026-11-08' })
    expect(semanaDe('2026-11-08')).toEqual({ inicio: '2026-11-02', fim: '2026-11-08' })
  })

  it('mês cobre do dia 1 ao último, inclusive fevereiro e virada de ano', () => {
    expect(mesDe('2026-11-15')).toEqual({ inicio: '2026-11-01', fim: '2026-11-30' })
    expect(mesDe('2028-02-10')).toEqual({ inicio: '2028-02-01', fim: '2028-02-29' })
    expect(mesDe('2027-01-05', -1)).toEqual({ inicio: '2026-12-01', fim: '2026-12-31' })
  })

  it('presets de semana/mês passados', () => {
    expect(periodoDoPreset('semana-passada', '2026-11-04')).toEqual({ inicio: '2026-10-26', fim: '2026-11-01' })
    expect(periodoDoPreset('mes-passado', '2026-11-04')).toEqual({ inicio: '2026-10-01', fim: '2026-10-31' })
  })

  it('lista os dias com as duas pontas incluídas', () => {
    expect(listarDias({ inicio: '2026-11-29', fim: '2026-12-02' })).toEqual(['2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02'])
  })

  it('o saldo inicial é da virada das 5h do 1º dia; o final, da virada do dia seguinte ao último', () => {
    const p = { inicio: '2026-11-02', fim: '2026-11-08' }
    expect(momentoInicial(p)).toBe('2026-11-02T05:00:00-03:00')
    expect(momentoFinal(p)).toBe('2026-11-09T05:00:00-03:00')
  })
})

describe('itemContaNoCmv', () => {
  it('exclui remanufaturado, material de limpeza e outros', () => {
    expect(itemContaNoCmv({ categoria: 'Bar', tipo_produto: 'Matéria Prima' })).toBe(true)
    expect(itemContaNoCmv({ categoria: 'Cozinha', tipo_produto: 'Pronto para Venda' })).toBe(true)
    expect(itemContaNoCmv({ categoria: 'Bar', tipo_produto: 'Remanufaturado' })).toBe(false)
    expect(itemContaNoCmv({ categoria: 'Material de Limpeza', tipo_produto: 'Matéria Prima' })).toBe(false)
    expect(itemContaNoCmv({ categoria: 'Outros', tipo_produto: 'Matéria Prima' })).toBe(false)
  })
})

describe('valorizarEstoque', () => {
  const itens = [
    item({ id: 'cerveja', title: 'Cerveja' }),
    item({ id: 'gin', title: 'Gin' }),
    item({ id: 'xarope', title: 'Xarope', tipo_produto: 'Remanufaturado' }),
    item({ id: 'vazio', title: 'Vazio' }),
    item({ id: 'limao', title: 'Limão' }),
  ]

  it('multiplica saldo por custo, separa o que não tem custo e ignora o resto', () => {
    const saldos = new Map([
      ['cerveja', 4],
      ['gin', 2.5],
      ['xarope', 10],
      ['vazio', 0],
      ['limao', 7],
    ])
    const custos = new Map([
      ['cerveja', 120],
      ['gin', 80],
      ['xarope', 5],
    ])
    const r = valorizarEstoque(itens, saldos, custos)
    expect(r.total).toBe(4 * 120 + 2.5 * 80) // 680
    expect(r.linhas.map((l) => l.itemId)).toEqual(['cerveja', 'gin']) // maior valor primeiro
    expect(r.semCusto.map((l) => l.itemId)).toEqual(['limao']) // saldo sem custo
  })

  it('saldo negativo (furo no histórico) vale zero e produto sem saldo informado é ignorado', () => {
    const r = valorizarEstoque(itens, new Map([['cerveja', -3]]), new Map([['cerveja', 120]]))
    expect(r.total).toBe(0)
    expect(r.linhas).toEqual([])
    expect(r.semCusto).toEqual([])
  })

  it('arredonda em centavos', () => {
    const r = valorizarEstoque([item({ id: 'a' })], new Map([['a', 333]]), new Map([['a', 0.0312]]))
    expect(r.total).toBe(10.39)
  })
})

describe('somarCompras', () => {
  const periodo = { inicio: '2026-11-01', fim: '2026-11-30' }

  it('soma só mercadoria, pela data da compra (ou vencimento) dentro do período', () => {
    const contas = [
      conta({ id: '1', valor: 100, data_compra: '2026-11-05', vencimento: '2026-12-05' }), // boleto 30 dias: conta em novembro
      conta({ id: '2', valor: 50, vencimento: '2026-11-20', categoria: 'Mercadoria – Alimentos' }), // sem data: vencimento
      conta({ id: '3', valor: 999, categoria: 'Energia', vencimento: '2026-11-10' }), // não é mercadoria
      conta({ id: '4', valor: 70, data_compra: '2026-10-31', vencimento: '2026-11-15' }), // comprada em outubro
      conta({ id: '5', valor: 30, data_compra: '2026-11-30', vencimento: '2027-01-01' }), // último dia entra
    ]
    const r = somarCompras(contas, periodo)
    expect(r.total).toBe(180)
    expect(r.contas.map((c) => c.id)).toEqual(['1', '2', '5'])
    expect(r.porCategoria).toEqual([
      { categoria: 'Mercadoria – Bebidas', total: 130, quantidade: 2 },
      { categoria: 'Mercadoria – Alimentos', total: 50, quantidade: 1 },
    ])
  })

  it('usa o valor da conta, não o valor pago', () => {
    const r = somarCompras([conta({ valor: 100, pago_em: '2026-11-06', valor_pago: 95, data_compra: '2026-11-05' })], periodo)
    expect(r.total).toBe(100)
  })
})

describe('somarFaturamento', () => {
  const periodo = { inicio: '2026-11-02', fim: '2026-11-08' }

  it('soma os dias lançados e lista os dias passados sem lançamento', () => {
    const dias = [
      { data: '2026-11-02', valor: 1000 },
      { data: '2026-11-03', valor: 0 }, // fechado
      { data: '2026-11-05', valor: 2500.5 },
      { data: '2026-11-20', valor: 777 }, // fora do período
    ]
    const r = somarFaturamento(dias, periodo, '2026-11-06')
    expect(r.total).toBe(3500.5)
    expect(r.diasLancados).toBe(3)
    expect(r.diasSemLancamento).toEqual(['2026-11-04', '2026-11-06'])
  })

  it('dias que ainda não chegaram não contam como "sem lançamento"', () => {
    expect(somarFaturamento([], periodo, '2026-11-02').diasSemLancamento).toEqual(['2026-11-02'])
    expect(somarFaturamento([], periodo, '2026-11-01').diasSemLancamento).toEqual([])
  })
})

describe('calcularCmv', () => {
  it('CMV = inicial + compras − final; % sobre o faturamento', () => {
    const r = calcularCmv({ estoqueInicial: 5000, compras: 3000, estoqueFinal: 4200, faturamento: 12000 })
    expect(r.cmv).toBe(3800)
    expect(r.percentual).toBeCloseTo(31.67, 1)
    expect(formatPercent(r.percentual!)).toBe('31,7%')
  })

  it('sem faturamento não há percentual', () => {
    expect(calcularCmv({ estoqueInicial: 100, compras: 0, estoqueFinal: 100, faturamento: 0 }).percentual).toBeNull()
  })

  it('pode dar negativo (estoque final maior que o resto) e o valor aparece como está', () => {
    expect(calcularCmv({ estoqueInicial: 100, compras: 0, estoqueFinal: 150, faturamento: 1000 }).cmv).toBe(-50)
  })
})

describe('parseValorBR com mais casas (custo por unidade)', () => {
  it('mantém 4 casas quando pedido e continua em 2 por padrão', () => {
    expect(parseValorBR('0,0312', 4)).toBe(0.0312)
    expect(parseValorBR('0.0312', 4)).toBe(0.0312)
    expect(parseValorBR('120,5', 4)).toBe(120.5)
    expect(parseValorBR('1.234,5678', 4)).toBe(1234.5678)
    expect(parseValorBR('0,0312')).toBe(0.03)
    expect(parseValorBR('1.234')).toBe(1234)
  })
})
