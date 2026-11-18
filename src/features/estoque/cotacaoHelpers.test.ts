import { describe, expect, it } from 'vitest'
import {
  escolherMaisBarato,
  estadoDeCotacao,
  itemDeCotacao,
  menorPreco,
  payloadDaCotacao,
  problemasParaGerarPedidos,
  textoPedidoDeCotacao,
  totaisDaEscolha,
  type CotacaoComFilhos,
  type CotacaoEstado,
} from './cotacaoHelpers'

const F1 = { id: 'f1', nome: 'Distribuidora A', observacoes: '' }
const F2 = { id: 'f2', nome: 'Atacado B', observacoes: 'entrega em 2 dias' }
const item = (id: string, quantidade: number, escolhidoId: string | null = null) => ({
  id,
  estoqueItemId: `e-${id}`,
  produto: `Produto ${id}`,
  categoria: 'Bar' as const,
  unidade: 'Fardo' as const,
  quantidade,
  escolhidoId,
})

function estado(p: Partial<CotacaoEstado> = {}): CotacaoEstado {
  return {
    id: null,
    titulo: '',
    observacoes: '',
    fornecedores: [F1, F2],
    itens: [item('i1', 10), item('i2', 2)],
    precos: { i1: { f1: 50, f2: 45 }, i2: { f1: 100, f2: 120 } },
    ...p,
  }
}

describe('menorPreco', () => {
  it('acha o fornecedor mais barato e ignora quem não cotou', () => {
    expect(menorPreco(estado(), 'i1')).toEqual({ fornecedorId: 'f2', preco: 45 })
    expect(menorPreco(estado({ precos: { i1: { f1: 50, f2: null } } }), 'i1')).toEqual({ fornecedorId: 'f1', preco: 50 })
    expect(menorPreco(estado({ precos: {} }), 'i1')).toBeNull()
  })
  it('empate fica com o primeiro; preço zero conta como preço', () => {
    expect(menorPreco(estado({ precos: { i1: { f1: 40, f2: 40 } } }), 'i1')?.fornecedorId).toBe('f1')
    expect(menorPreco(estado({ precos: { i1: { f1: 0, f2: 10 } } }), 'i1')?.preco).toBe(0)
  })
})

describe('escolherMaisBarato', () => {
  it('escolhe o menor de cada produto e mantém o que não tem preço', () => {
    const r = escolherMaisBarato(estado({ itens: [item('i1', 10), item('i2', 2), item('i3', 1, 'f1')] }))
    expect(r.itens.map((i) => i.escolhidoId)).toEqual(['f2', 'f1', 'f1'])
  })
})

describe('totaisDaEscolha', () => {
  it('soma por fornecedor (preço × quantidade) e calcula a economia contra o mais caro', () => {
    const e = escolherMaisBarato(estado())
    const t = totaisDaEscolha(e)
    // i1: 10 × 45 no f2 = 450 (o mais caro seria 50 -> economia 50); i2: 2 × 100 no f1 = 200 (o mais caro 120 -> economia 40)
    expect(t.porFornecedor).toEqual({ f2: 450, f1: 200 })
    expect(t.total).toBe(650)
    expect(t.economia).toBe(90)
  })
  it('produto sem escolha ou sem preço não entra no total', () => {
    const t = totaisDaEscolha(estado({ itens: [item('i1', 10, 'f2'), item('i2', 2, null)] }))
    expect(t.total).toBe(450)
  })
  it('arredonda em centavos', () => {
    const t = totaisDaEscolha(estado({ itens: [item('i1', 3, 'f1')], precos: { i1: { f1: 0.3333 } } }))
    expect(t.total).toBe(1)
  })
})

describe('problemasParaGerarPedidos', () => {
  it('exige produto, fornecedor, escolha e preço do escolhido', () => {
    expect(problemasParaGerarPedidos(estado({ itens: [] }))).toEqual(['Adicione ao menos um produto.'])
    expect(problemasParaGerarPedidos(estado({ fornecedores: [] }))).toEqual(['Adicione ao menos um fornecedor.'])
    expect(problemasParaGerarPedidos(estado())).toHaveLength(2) // ninguém escolhido
    expect(problemasParaGerarPedidos(estado({ itens: [item('i1', 10, 'f1')], precos: { i1: { f2: 45 } } }))).toEqual([
      '"Produto i1": o fornecedor escolhido está sem preço.',
    ])
    expect(problemasParaGerarPedidos(escolherMaisBarato(estado()))).toEqual([])
  })
  it('recusa quantidade zero', () => {
    expect(problemasParaGerarPedidos(estado({ itens: [item('i1', 0, 'f1')] }))[0]).toContain('quantidade')
  })
})

describe('itemDeCotacao', () => {
  it('arredonda a sugestão pra cima e usa 1 quando não há sugestão', () => {
    const base = { id: 'e1', title: 'Gin', categoria: 'Bar' as const, unidade: 'Unidade' as const }
    expect(itemDeCotacao(base, 2.3).quantidade).toBe(3)
    expect(itemDeCotacao(base, null).quantidade).toBe(1)
    expect(itemDeCotacao(base, 0).quantidade).toBe(1)
  })
})

describe('textoPedidoDeCotacao', () => {
  it('lista quantidade, unidade e produto', () => {
    const t = textoPedidoDeCotacao(estado({ itens: [{ ...item('i1', 2.5), produto: 'Cerveja Heineken' }] }))
    expect(t).toContain('• 2,5')
    expect(t).toContain('Cerveja Heineken')
  })
})

describe('banco <-> estado', () => {
  const linha: CotacaoComFilhos = {
    id: 'c1',
    titulo: 'Cotação de bebidas',
    observacoes: null,
    status: 'aberta',
    criado_por: null,
    criado_em: '',
    atualizado_em: '',
    finalizada_em: null,
    cotacao_fornecedores: [
      { id: 'f2', cotacao_id: 'c1', nome: 'B', observacoes: null, ordem: 1 },
      { id: 'f1', cotacao_id: 'c1', nome: 'A', observacoes: 'prazo 2 dias', ordem: 0 },
    ],
    cotacao_itens: [
      {
        id: 'i1',
        cotacao_id: 'c1',
        estoque_item_id: 'e1',
        produto: 'Gin',
        categoria: 'Bar',
        unidade: 'Unidade',
        quantidade: 6,
        ordem: 0,
        fornecedor_escolhido_id: 'f1',
        cotacao_precos: [{ item_id: 'i1', fornecedor_id: 'f1', preco_unitario: 80.5 }],
      },
    ],
  }

  it('estadoDeCotacao ordena fornecedores e monta a matriz de preços', () => {
    const e = estadoDeCotacao(linha)
    expect(e.fornecedores.map((f) => f.id)).toEqual(['f1', 'f2'])
    expect(e.precos).toEqual({ i1: { f1: 80.5 } })
    expect(e.itens[0].escolhidoId).toBe('f1')
  })

  it('payloadDaCotacao só manda preços existentes e descarta escolha de fornecedor removido', () => {
    const e = estadoDeCotacao(linha)
    const p = payloadDaCotacao({ ...e, fornecedores: e.fornecedores.filter((f) => f.id === 'f2') }) as {
      precos: unknown[]
      itens: { fornecedor_escolhido_id: string | null }[]
    }
    expect(p.precos).toEqual([])
    expect(p.itens[0].fornecedor_escolhido_id).toBeNull()
    expect((payloadDaCotacao(e) as { precos: unknown[] }).precos).toEqual([{ item_id: 'i1', fornecedor_id: 'f1', preco_unitario: 80.5 }])
  })
})
