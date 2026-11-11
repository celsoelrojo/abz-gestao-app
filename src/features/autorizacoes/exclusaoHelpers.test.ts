import { describe, expect, it } from 'vitest'
import { anexosDoRegistro, pedidosPendentes, resumirDados, rotuloTabela } from './exclusaoHelpers'

describe('rotuloTabela', () => {
  it('nome amigável; tabela desconhecida aparece como está', () => {
    expect(rotuloTabela('contas_pagar')).toBe('Conta a pagar')
    expect(rotuloTabela('outra_tabela')).toBe('outra_tabela')
  })
})

describe('anexosDoRegistro', () => {
  it('lista o anexo do storage do registro, ignorando vazio e URL externa', () => {
    expect(anexosDoRegistro('contas_pagar', { nota_foto_path: 'u1/123.jpg' })).toEqual([{ bucket: 'notas-fiscais', path: 'u1/123.jpg' }])
    expect(anexosDoRegistro('contas_pagar', { nota_foto_path: null })).toEqual([])
    expect(anexosDoRegistro('mapa_blocks', { image_url: 'https://site.com/x.png' })).toEqual([])
    expect(anexosDoRegistro('pops', { titulo: 'x' })).toEqual([])
  })
})

describe('resumirDados', () => {
  it('mostra só campos simples, sem ids, datas de sistema, vazios nem listas', () => {
    const r = resumirDados({
      id: 'a',
      descricao: 'Energia',
      valor: 120.5,
      pago: false,
      observacoes: '',
      criado_por: 'u',
      created_at: '2026-01-01',
      itens: [1, 2],
      fornecedor_id: 'f',
      categoria: null,
    })
    expect(r).toEqual([
      { campo: 'Descricao', valor: 'Energia' },
      { campo: 'Valor', valor: '120.5' },
      { campo: 'Pago', valor: 'Não' },
    ])
  })
  it('respeita o máximo e corta texto muito longo', () => {
    expect(resumirDados({ a: '1', b: '2', c: '3' }, 2)).toHaveLength(2)
    expect(resumirDados({ texto: 'x'.repeat(500) })[0].valor).toHaveLength(160)
  })
})

describe('pedidosPendentes', () => {
  it('conta só os pendentes', () => {
    expect(pedidosPendentes([{ status: 'pendente' }, { status: 'aprovada' }, { status: 'pendente' }, { status: 'recusada' }])).toBe(2)
  })
})
