import { describe, expect, it } from 'vitest'
import { motivoProdutoIncompativel, mudancasDeVinculo, unidadeEstoqueDoRendimento } from './vinculoEstoque'

describe('vínculo da ficha de produção com o estoque', () => {
  it('traduz a unidade do rendimento pra unidade do estoque', () => {
    expect(unidadeEstoqueDoRendimento('Litros')).toBe('Litro')
    expect(unidadeEstoqueDoRendimento('Porção')).toBe('Unidade')
    expect(unidadeEstoqueDoRendimento('')).toBeNull()
  })

  it('recusa unidade diferente e produto de outra ficha', () => {
    expect(motivoProdutoIncompativel({ unidade: 'Litro', ficha_producao_id: null }, 'a', 'Litros')).toBeNull()
    expect(motivoProdutoIncompativel({ unidade: 'Litro', ficha_producao_id: 'a' }, 'a', 'Litros')).toBeNull()
    expect(motivoProdutoIncompativel({ unidade: 'Mililitro', ficha_producao_id: null }, 'a', 'Litros')).toContain('Mililitro')
    expect(motivoProdutoIncompativel({ unidade: 'Litro', ficha_producao_id: 'b' }, 'a', 'Litros')).toContain('outra ficha')
    // ficha nova ainda não tem id: qualquer vínculo existente é de outra ficha
    expect(motivoProdutoIncompativel({ unidade: 'Litro', ficha_producao_id: 'b' }, null, 'Litros')).toContain('outra ficha')
  })

  it('deixa a ficha ligada a um único produto', () => {
    const itens = [
      { id: '1', ficha_producao_id: 'a' },
      { id: '2', ficha_producao_id: null },
      { id: '3', ficha_producao_id: 'b' },
    ]
    expect(mudancasDeVinculo(itens, 'a', '2')).toEqual({ desligar: ['1'], ligar: '2' })
    expect(mudancasDeVinculo(itens, 'a', '1')).toEqual({ desligar: [], ligar: null })
    expect(mudancasDeVinculo(itens, 'a', '')).toEqual({ desligar: ['1'], ligar: null })
  })
})
