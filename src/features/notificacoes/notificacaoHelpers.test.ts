import { describe, expect, it } from 'vitest'
import { CODIGO_VALIDADE_MIN, expiracaoDoCodigo, gerarCodigoAtivacao, rotuloSetorDestino, situacaoDestino } from './notificacaoHelpers'

describe('gerarCodigoAtivacao', () => {
  it('formato ABZ-XXXXX sem caracteres ambíguos e diferente a cada chamada', () => {
    const codigos = new Set(Array.from({ length: 50 }, gerarCodigoAtivacao))
    for (const c of codigos) expect(c).toMatch(/^ABZ-[A-HJ-NP-Z2-9]{5}$/)
    expect(codigos.size).toBeGreaterThan(45)
  })
})

describe('situacaoDestino', () => {
  const agora = new Date('2026-11-03T12:00:00Z')
  const vazio = { chat_id: null, codigo_ativacao: null, codigo_expira_em: null }

  it('conectado quando já tem chat, mesmo sem código', () => {
    expect(situacaoDestino({ ...vazio, chat_id: 123 }, agora)).toBe('conectado')
  })
  it('aguardando enquanto o código está na validade; depois expira', () => {
    const expira = expiracaoDoCodigo(agora)
    expect(new Date(expira).getTime() - agora.getTime()).toBe(CODIGO_VALIDADE_MIN * 60_000)
    expect(situacaoDestino({ ...vazio, codigo_ativacao: 'ABZ-AAAAA', codigo_expira_em: expira }, agora)).toBe('aguardando')
    expect(situacaoDestino({ ...vazio, codigo_ativacao: 'ABZ-AAAAA', codigo_expira_em: expira }, new Date('2026-11-03T12:31:00Z'))).toBe('codigo_expirado')
    expect(situacaoDestino(vazio, agora)).toBe('codigo_expirado')
  })
})

describe('rotuloSetorDestino', () => {
  it('sem setor vale todos', () => {
    expect(rotuloSetorDestino(null)).toBe('Todos os setores')
    expect(rotuloSetorDestino('Bar')).toBe('Bar')
  })
})
