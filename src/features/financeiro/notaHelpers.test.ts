import { describe, expect, it } from 'vitest'
import { chaveFornecedor, divergenciaTotal, normalizarTexto, sanearNota, similaridade, somaItens, sugerirProduto } from './notaHelpers'

describe('sanearNota', () => {
  it('limpa tipos, dígitos e descarta itens sem descrição', () => {
    const n = sanearNota({
      legivel: true,
      fornecedor: '  Distribuidora X ',
      cnpj: '12.345.678/0001-90',
      chave_acesso: '1234',
      data_emissao: '2026-10-30',
      valor_total: 123.456,
      itens: [
        { descricao: 'CERV 600ML', quantidade: 12, unidade: 'cx', valor_unitario: '5.5', valor_total: 66 },
        { descricao: '   ', quantidade: 1 },
        null,
      ],
    })
    expect(n.fornecedor).toBe('Distribuidora X')
    expect(n.cnpj).toBe('12345678000190')
    expect(n.chave_acesso).toBe('') // incompleta
    expect(n.data_emissao).toBe('2026-10-30')
    expect(n.valor_total).toBe(123.46)
    expect(n.itens).toHaveLength(1)
    expect(n.itens[0]).toMatchObject({ unidade: 'CX', valor_unitario: 5.5 })
  })

  it('lixo vira nota vazia e não legível', () => {
    const n = sanearNota('texto qualquer')
    expect(n.legivel).toBe(false)
    expect(n.itens).toEqual([])
    expect(n.valor_total).toBe(0)
  })

  it('recusa data inválida e número negativo', () => {
    const n = sanearNota({ data_emissao: '30/10/2026', valor_total: -5, itens: [{ descricao: 'x', quantidade: -2 }] })
    expect(n.data_emissao).toBe('')
    expect(n.valor_total).toBe(0)
    expect(n.itens[0].quantidade).toBe(0)
  })
})

describe('normalizarTexto', () => {
  it('tira acento/pontuação e junta número com unidade', () => {
    expect(normalizarTexto('Cerveja Heineken, 600 ML!')).toBe('cerveja heineken 600ml')
    expect(normalizarTexto('  ÁGUA  c/ gás ')).toBe('agua c gas')
  })
})

describe('chaveFornecedor', () => {
  it('usa o CNPJ quando tem 14 dígitos; senão o nome normalizado', () => {
    expect(chaveFornecedor('12.345.678/0001-90', 'X')).toBe('12345678000190')
    expect(chaveFornecedor('', 'Distribuidora São João')).toBe('distribuidora sao joao')
  })
})

describe('similaridade', () => {
  it('abreviação de nota casa com o nome do produto', () => {
    expect(similaridade('CERV HEINEKEN 600ML', 'Cerveja Heineken 600ml')).toBeGreaterThanOrEqual(0.9)
  })
  it('itens diferentes ficam abaixo do limiar', () => {
    // marcas diferentes, mesma medida: abaixo do limiar de sugestão (0.7)
    expect(similaridade('CERV HEINEKEN 600ML', 'Cerveja Brahma 600ml')).toBeLessThan(0.7)
    expect(similaridade('', 'Cerveja')).toBe(0)
  })
})

describe('sugerirProduto', () => {
  const produtos = [
    { id: 'p1', title: 'Cerveja Heineken 600ml' },
    { id: 'p2', title: 'Cerveja Brahma 600ml' },
    { id: 'p3', title: 'Água sem gás 500ml' },
  ]
  it('sugere por semelhança de nome', () => {
    expect(sugerirProduto('CERV HEINEKEN 600ML', 'f1', produtos, [])).toEqual({ estoqueItemId: 'p1', origem: 'sugerido' })
  })
  it('o aprendizado do fornecedor vence a semelhança', () => {
    const map = [{ fornecedor_chave: 'f1', descricao_norm: normalizarTexto('HNK 600'), estoque_item_id: 'p1' }]
    expect(sugerirProduto('HNK 600', 'f1', produtos, map)).toEqual({ estoqueItemId: 'p1', origem: 'aprendido' })
  })
  it('aprendizado de outro fornecedor ou de produto apagado não vale', () => {
    const outro = [{ fornecedor_chave: 'f2', descricao_norm: normalizarTexto('HNK 600'), estoque_item_id: 'p1' }]
    const apagado = [{ fornecedor_chave: 'f1', descricao_norm: normalizarTexto('HNK 600'), estoque_item_id: 'sumiu' }]
    expect(sugerirProduto('HNK 600', 'f1', produtos, outro)).toBeNull()
    expect(sugerirProduto('HNK 600', 'f1', produtos, apagado)).toBeNull()
  })
  it('sem nada parecido devolve null', () => {
    expect(sugerirProduto('SACO DE LIXO 100L', 'f1', produtos, [])).toBeNull()
  })
})

describe('divergenciaTotal', () => {
  it('compara o total da nota com a soma dos itens', () => {
    const itens = [{ valor_total: 10.1 }, { valor_total: 20.2 }]
    expect(somaItens(itens)).toBe(30.3)
    expect(divergenciaTotal(30.3, itens)).toBe(0)
    expect(divergenciaTotal(35, itens)).toBe(4.7)
  })
})
