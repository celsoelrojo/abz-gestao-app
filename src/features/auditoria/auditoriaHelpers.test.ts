import { describe, expect, it } from 'vitest'
import { summarizeAudit } from './auditoriaHelpers'

describe('summarizeAudit', () => {
  it('INSERT retorna "Registro criado"', () => {
    expect(summarizeAudit({ action: 'INSERT', old_data: null, new_data: { nome: 'x' } })).toBe('Registro criado')
  })

  it('DELETE retorna "Registro excluído"', () => {
    expect(summarizeAudit({ action: 'DELETE', old_data: { nome: 'x' }, new_data: null })).toBe('Registro excluído')
  })

  it('UPDATE lista campos alterados, ignorando colunas técnicas', () => {
    const result = summarizeAudit({
      action: 'UPDATE',
      old_data: { id: '1', updated_at: 'a', status: 'rascunho', titulo: 'A' },
      new_data: { id: '1', updated_at: 'b', status: 'publicada', titulo: 'A' },
    })
    expect(result).toBe('status: rascunho → publicada')
  })

  it('UPDATE sem mudança relevante retorna mensagem neutra', () => {
    const result = summarizeAudit({
      action: 'UPDATE',
      old_data: { id: '1', updated_at: 'a' },
      new_data: { id: '1', updated_at: 'b' },
    })
    expect(result).toBe('Atualização sem mudanças relevantes')
  })
})
