import { describe, expect, it } from 'vitest'
import { ordenarAbertas, ordenarEncerradas, podeEditarRequisicao, requisicaoAberta, requisicaoFormError } from './requisicaoHelpers'
import type { ProfileRow, RequisicaoRow } from '../../types/database'

function req(parcial: Partial<RequisicaoRow>): RequisicaoRow {
  return {
    id: 'r',
    tipo: 'compra',
    titulo: 'Lixeira',
    descricao: null,
    urgencia: 'media',
    foto_path: null,
    status: 'pendente',
    motivo_recusa: null,
    solicitante_id: 'u1',
    solicitante_nome: 'Ana',
    setor: 'Bar',
    decidido_por_nome: null,
    decidido_em: null,
    created_at: '2026-10-01T10:00:00Z',
    updated_at: '2026-10-01T10:00:00Z',
    ...parcial,
  }
}

const perfil = (role: string, id = 'u1') => ({ id, role }) as ProfileRow

describe('requisicaoAberta', () => {
  it('pendente e aprovada pedem ação; concluída e recusada não', () => {
    expect(requisicaoAberta('pendente')).toBe(true)
    expect(requisicaoAberta('aprovada')).toBe(true)
    expect(requisicaoAberta('concluida')).toBe(false)
    expect(requisicaoAberta('recusada')).toBe(false)
  })
})

describe('ordenarAbertas', () => {
  it('pendente antes de aprovada; mais urgente antes; mais antiga antes', () => {
    const lista = [
      req({ id: 'aprovada-alta', status: 'aprovada', urgencia: 'alta' }),
      req({ id: 'pend-baixa', urgencia: 'baixa' }),
      req({ id: 'pend-alta-nova', urgencia: 'alta', created_at: '2026-10-05T10:00:00Z' }),
      req({ id: 'pend-alta-velha', urgencia: 'alta', created_at: '2026-10-02T10:00:00Z' }),
    ]
    expect(ordenarAbertas(lista).map((r) => r.id)).toEqual(['pend-alta-velha', 'pend-alta-nova', 'pend-baixa', 'aprovada-alta'])
  })
})

describe('ordenarEncerradas', () => {
  it('a decidida mais recentemente vem primeiro', () => {
    const lista = [
      req({ id: 'a', status: 'concluida', decidido_em: '2026-10-03T10:00:00Z' }),
      req({ id: 'b', status: 'recusada', decidido_em: '2026-10-09T10:00:00Z' }),
    ]
    expect(ordenarEncerradas(lista).map((r) => r.id)).toEqual(['b', 'a'])
  })
})

describe('requisicaoFormError', () => {
  it('exige um título', () => {
    expect(requisicaoFormError({ titulo: '   ' })).not.toBeNull()
    expect(requisicaoFormError({ titulo: 'Ventilador quebrado' })).toBeNull()
  })
})

describe('podeEditarRequisicao', () => {
  it('administrador sempre; dono só enquanto pendente; outros nunca', () => {
    expect(podeEditarRequisicao(perfil('administrador', 'adm'), req({ status: 'concluida' }))).toBe(true)
    expect(podeEditarRequisicao(perfil('bar'), req({ status: 'pendente' }))).toBe(true)
    expect(podeEditarRequisicao(perfil('bar'), req({ status: 'aprovada' }))).toBe(false)
    expect(podeEditarRequisicao(perfil('gestor_bar', 'g1'), req({ status: 'pendente' }))).toBe(false)
    expect(podeEditarRequisicao(null, req({}))).toBe(false)
  })
})
