import { describe, expect, it } from 'vitest'
import { summarizeProfileAudit } from './auditSummary'

describe('summarizeProfileAudit', () => {
  it('resume um INSERT como criação de conta', () => {
    expect(summarizeProfileAudit({ action: 'INSERT', old_data: null, new_data: { nome: 'Ana' } })).toBe(
      'Conta criada',
    )
  })

  it('resume um DELETE como exclusão de conta', () => {
    expect(summarizeProfileAudit({ action: 'DELETE', old_data: { nome: 'Ana' }, new_data: null })).toBe(
      'Conta excluída',
    )
  })

  it('lista um único campo alterado num UPDATE', () => {
    const summary = summarizeProfileAudit({
      action: 'UPDATE',
      old_data: { status: 'pendente', role: 'bar' },
      new_data: { status: 'ativa', role: 'bar' },
    })
    expect(summary).toBe('status: pendente → ativa')
  })

  it('lista múltiplos campos alterados, separados por vírgula', () => {
    const summary = summarizeProfileAudit({
      action: 'UPDATE',
      old_data: { role: 'bar', setor: 'Bar' },
      new_data: { role: 'gestor_bar', setor: 'Bar' },
    })
    expect(summary).toBe('perfil: bar → gestor_bar')
  })

  it('ignora campos técnicos não mapeados (ex.: updated_at)', () => {
    const summary = summarizeProfileAudit({
      action: 'UPDATE',
      old_data: { nome: 'Ana', updated_at: '2026-01-01' },
      new_data: { nome: 'Ana', updated_at: '2026-01-02' },
    })
    expect(summary).toBe('Atualização sem mudanças relevantes')
  })
})
