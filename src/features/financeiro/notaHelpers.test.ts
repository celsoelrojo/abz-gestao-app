import { describe, expect, it } from 'vitest'
import {
  candidatosProduto,
  chaveFornecedor,
  divergenciaTotal,
  fatorDeConversao,
  fatorPorUnidades,
  normalizarTexto,
  ordenarProdutosParaNota,
  quantidadeNoEstoque,
  sanearNota,
  similaridade,
  somaItens,
  sugerirProduto,
  unidadeDaNota,
} from './notaHelpers'

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
    expect(sugerirProduto('CERV HEINEKEN 600ML', 'f1', produtos, [])).toEqual({ estoqueItemId: 'p1', origem: 'sugerido', fator: 1 })
  })
  it('o aprendizado do fornecedor vence a semelhança e traz o fator de conversão', () => {
    const map = [{ fornecedor_chave: 'f1', descricao_norm: normalizarTexto('HNK 600'), estoque_item_id: 'p1', fator: 12 }]
    expect(sugerirProduto('HNK 600', 'f1', produtos, map)).toEqual({ estoqueItemId: 'p1', origem: 'aprendido', fator: 12 })
  })
  it('aprendizado de outro fornecedor ou de produto apagado não vale', () => {
    const outro = [{ fornecedor_chave: 'f2', descricao_norm: normalizarTexto('HNK 600'), estoque_item_id: 'p1', fator: 1 }]
    const apagado = [{ fornecedor_chave: 'f1', descricao_norm: normalizarTexto('HNK 600'), estoque_item_id: 'sumiu', fator: 1 }]
    expect(sugerirProduto('HNK 600', 'f1', produtos, outro)).toBeNull()
    expect(sugerirProduto('HNK 600', 'f1', produtos, apagado)).toBeNull()
  })
  it('sem nada parecido devolve null', () => {
    expect(sugerirProduto('SACO DE LIXO 100L', 'f1', produtos, [])).toBeNull()
  })
})

describe('candidatosProduto / descrição de nota com palavras a mais', () => {
  const produtos = [
    { id: 'a', title: 'Açúcar cristal', marca: null },
    { id: 'b', title: 'Açúcar demerara', marca: null },
    { id: 'c', title: 'Gin Tanqueray', marca: 'Diageo' },
    { id: 'd', title: 'Sal grosso', marca: null },
  ]
  it('acha o produto cujo nome está dentro da descrição da nota', () => {
    expect(candidatosProduto('ACUCAR CRISTAL UNIAO 5KG', produtos).map((p) => p.id)).toEqual(['a'])
    expect(sugerirProduto('ACUCAR CRISTAL UNIAO 5KG', 'f1', produtos, [])).toEqual({ estoqueItemId: 'a', origem: 'sugerido', fator: 1 })
  })
  it('usa a marca do cadastro e abreviação de nota', () => {
    expect(candidatosProduto('GIN TANQ 750ML DIAGEO', produtos)[0].id).toBe('c')
  })
  it('sem palavra em comum não sugere nada, e número sozinho não basta', () => {
    expect(candidatosProduto('SACO DE LIXO 100L', produtos)).toEqual([])
    expect(candidatosProduto('REFRIGERANTE 600ML', [{ id: 'x', title: '600ml', marca: null }])).toEqual([])
  })
  it('respeita o máximo de candidatos', () => {
    expect(candidatosProduto('ACUCAR CRISTAL DEMERARA', produtos, 1)).toHaveLength(1)
  })
})

describe('fatorPorUnidades (quantidade sugerida pelas unidades)', () => {
  const unidade = { unidade: 'Unidade' as const, unidades_por_embalagem: 12 }
  it('reconhece as unidades escritas na nota', () => {
    expect(unidadeDaNota('cx')).toBe('Caixa')
    expect(unidadeDaNota('FD')).toBe('Fardo')
    expect(unidadeDaNota('Un.')).toBe('Unidade')
    expect(unidadeDaNota('LT')).toBe('Litro')
    expect(unidadeDaNota('XPTO')).toBeNull()
  })
  it('mesma unidade vale 1; kg↔g e l↔ml pelo tamanho', () => {
    expect(fatorPorUnidades('KG', { unidade: 'Quilo', unidades_por_embalagem: null })).toBe(1)
    expect(fatorPorUnidades('KG', { unidade: 'Grama', unidades_por_embalagem: null })).toBe(1000)
    expect(fatorPorUnidades('ML', { unidade: 'Litro', unidades_por_embalagem: null })).toBe(0.001)
  })
  it('embalagem da nota → unidade do estoque usa as unidades por embalagem do cadastro', () => {
    expect(fatorPorUnidades('CX', unidade)).toBe(12)
    expect(fatorPorUnidades('UN', { unidade: 'Caixa', unidades_por_embalagem: 12 })).toBe(0.0833)
  })
  it('sem como saber devolve null', () => {
    expect(fatorPorUnidades('CX', { unidade: 'Unidade', unidades_por_embalagem: null })).toBeNull()
    expect(fatorPorUnidades('KG', { unidade: 'Litro', unidades_por_embalagem: null })).toBeNull()
    expect(fatorPorUnidades('???', unidade)).toBeNull()
  })
})

describe('ordenarProdutosParaNota', () => {
  const produtos = [
    { title: 'Água sem gás 500ml', marca: null },
    { title: 'Cerveja Brahma 600ml', marca: 'Ambev' },
    { title: 'Cerveja Heineken 600ml', marca: 'Heineken' },
  ]
  it('sem busca lista todos, os mais parecidos com a nota primeiro', () => {
    const r = ordenarProdutosParaNota('CERV HEINEKEN 600ML', produtos, '')
    expect(r.map((p) => p.title)).toEqual(['Cerveja Heineken 600ml', 'Cerveja Brahma 600ml', 'Água sem gás 500ml'])
  })
  it('com busca exige todas as palavras (título ou marca), sem acento', () => {
    expect(ordenarProdutosParaNota('x', produtos, 'agua 500').map((p) => p.title)).toEqual(['Água sem gás 500ml'])
    expect(ordenarProdutosParaNota('x', produtos, 'ambev').map((p) => p.title)).toEqual(['Cerveja Brahma 600ml'])
    expect(ordenarProdutosParaNota('x', produtos, 'cerveja vinho')).toEqual([])
  })
})

describe('fator de conversão nota → estoque', () => {
  it('quantas do estoque por 1 da nota; sem número válido não conclui', () => {
    expect(fatorDeConversao(2, 24)).toBe(12)
    expect(fatorDeConversao(3, 1)).toBe(0.3333)
    expect(fatorDeConversao(0, 24)).toBeNull()
    expect(fatorDeConversao(2, 0)).toBeNull()
  })
  it('aplica o fator à quantidade da nota', () => {
    expect(quantidadeNoEstoque(2, 12)).toBe(24)
    expect(quantidadeNoEstoque(1.5, 1)).toBe(1.5)
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
