import { describe, expect, it } from 'vitest'
import {
  contaFormError,
  gerarVencimentos,
  ordenarEmAberto,
  parseValorBR,
  resumirContas,
  situacaoConta,
  somarDias,
  somarMeses,
} from './contaHelpers'
import type { ContaPagarRow } from '../../types/database'

function conta(p: Partial<ContaPagarRow>): ContaPagarRow {
  return {
    id: 'c',
    descricao: 'Energia',
    fornecedor: null,
    categoria: 'Energia',
    valor: 100,
    vencimento: '2026-10-20',
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
    criado_por: null,
    created_at: '2026-10-01T10:00:00Z',
    updated_at: '2026-10-01T10:00:00Z',
    ...p,
  }
}

describe('situacaoConta', () => {
  it('classifica paga, vencida, vence hoje e a vencer', () => {
    expect(situacaoConta(conta({ pago_em: '2026-10-10', valor_pago: 100 }), '2026-10-31')).toBe('paga')
    expect(situacaoConta(conta({ vencimento: '2026-10-30' }), '2026-10-31')).toBe('vencida')
    expect(situacaoConta(conta({ vencimento: '2026-10-31' }), '2026-10-31')).toBe('vence_hoje')
    expect(situacaoConta(conta({ vencimento: '2026-11-01' }), '2026-10-31')).toBe('a_vencer')
  })
})

describe('parseValorBR', () => {
  it('entende formatos brasileiros e simples', () => {
    expect(parseValorBR('1.234,56')).toBe(1234.56)
    expect(parseValorBR('1234,5')).toBe(1234.5)
    expect(parseValorBR('R$ 50')).toBe(50)
    expect(parseValorBR('12.5')).toBe(12.5)
    expect(parseValorBR('1.234')).toBe(1234)
    expect(parseValorBR('1.234.567')).toBe(1234567)
  })
  it('vazio ou lixo é nulo', () => {
    expect(parseValorBR('')).toBeNull()
    expect(parseValorBR('abc')).toBeNull()
  })
})

describe('somarMeses / gerarVencimentos', () => {
  it('mantém o dia e cai no último dia quando o mês é mais curto', () => {
    expect(somarMeses('2026-01-31', 1)).toBe('2026-02-28')
    expect(somarMeses('2028-01-31', 1)).toBe('2028-02-29')
    expect(somarMeses('2026-11-15', 2)).toBe('2027-01-15')
  })
  it('cada vencimento parte do primeiro (31 volta a 31 depois de fevereiro)', () => {
    expect(gerarVencimentos('2026-01-31', 4)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'])
    expect(gerarVencimentos('2026-10-05', 1)).toEqual(['2026-10-05'])
  })
})

describe('somarDias', () => {
  it('atravessa fim de mês e de ano', () => {
    expect(somarDias('2026-10-31', 7)).toBe('2026-11-07')
    expect(somarDias('2026-12-30', 3)).toBe('2027-01-02')
  })
})

describe('resumirContas', () => {
  it('separa vencidas, próximos 7 dias, em aberto e pago no mês', () => {
    const contas = [
      conta({ id: 'a', valor: 100, vencimento: '2026-10-25' }), // vencida
      conta({ id: 'b', valor: 50.5, vencimento: '2026-10-31' }), // vence hoje -> próximos 7
      conta({ id: 'c', valor: 200, vencimento: '2026-11-07' }), // limite inclusive
      conta({ id: 'd', valor: 300, vencimento: '2026-11-08' }), // só em aberto
      conta({ id: 'e', valor: 80, pago_em: '2026-10-05', valor_pago: 75 }), // pago no mês
      conta({ id: 'f', valor: 90, pago_em: '2026-09-30', valor_pago: 90 }), // pago em outro mês
    ]
    const r = resumirContas(contas, '2026-10-31')
    expect(r.emAberto).toEqual({ total: 650.5, quantidade: 4 })
    expect(r.vencidas).toEqual({ total: 100, quantidade: 1 })
    expect(r.proximos7).toEqual({ total: 250.5, quantidade: 2 })
    expect(r.pagoNoMes).toEqual({ total: 75, quantidade: 1 })
  })
})

describe('ordenarEmAberto', () => {
  it('vencimento mais antigo primeiro', () => {
    const lista = [conta({ id: 'x', vencimento: '2026-11-02' }), conta({ id: 'y', vencimento: '2026-10-01' })]
    expect(ordenarEmAberto(lista).map((c) => c.id)).toEqual(['y', 'x'])
  })
})

describe('contaFormError', () => {
  const ok = { descricao: 'Luz', valor: 10, vencimento: '2026-10-31', repeticoes: 1 }
  it('aceita um preenchimento válido', () => expect(contaFormError(ok)).toBeNull())
  it('recusa descrição vazia, valor inválido, sem data e repetição fora do limite', () => {
    expect(contaFormError({ ...ok, descricao: ' ' })).not.toBeNull()
    expect(contaFormError({ ...ok, valor: null })).not.toBeNull()
    expect(contaFormError({ ...ok, valor: 0 })).not.toBeNull()
    expect(contaFormError({ ...ok, vencimento: '' })).not.toBeNull()
    expect(contaFormError({ ...ok, repeticoes: 61 })).not.toBeNull()
  })
})
