import { describe, expect, it } from 'vitest'
import { isFullAdmin, isManager, isSetorManager } from './authStore'
import type { ProfileRow } from '../types/database'

function makeProfile(overrides: Partial<ProfileRow>): ProfileRow {
  return {
    id: '1',
    nome: 'Fulano',
    username: 'fulano',
    role: 'bar',
    setor: 'Bar',
    status: 'ativa',
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

// Estes helpers só existem pra UI (mostrar/esconder) — a permissão de
// verdade é a RLS no banco (ver supabase/migrations). Ainda assim, testar
// a lógica evita regressão visual (ex.: um Gestor de outro setor ver botão
// de ação que a RLS ia recusar de qualquer forma, mas que não devia nem
// aparecer).
describe('isFullAdmin', () => {
  it('true só para role administrador', () => {
    expect(isFullAdmin(makeProfile({ role: 'administrador' }))).toBe(true)
    expect(isFullAdmin(makeProfile({ role: 'gestor_bar' }))).toBe(false)
    expect(isFullAdmin(null)).toBe(false)
  })
})

describe('isSetorManager', () => {
  it('true só para os 3 papéis de gestor de setor', () => {
    expect(isSetorManager(makeProfile({ role: 'gestor_bar' }))).toBe(true)
    expect(isSetorManager(makeProfile({ role: 'gestor_cozinha' }))).toBe(true)
    expect(isSetorManager(makeProfile({ role: 'gestor_salao' }))).toBe(true)
    expect(isSetorManager(makeProfile({ role: 'administrador' }))).toBe(false)
    expect(isSetorManager(makeProfile({ role: 'bar' }))).toBe(false)
  })
})

describe('isManager', () => {
  it('Administrador gerencia qualquer setor', () => {
    const admin = makeProfile({ role: 'administrador', setor: null })
    expect(isManager(admin)).toBe(true)
    expect(isManager(admin, 'Bar')).toBe(true)
    expect(isManager(admin, 'Cozinha')).toBe(true)
  })

  it('Gestor de setor só gerencia o próprio setor', () => {
    const gestorBar = makeProfile({ role: 'gestor_bar', setor: 'Bar' })
    expect(isManager(gestorBar)).toBe(true) // checagem genérica, sem setor específico
    expect(isManager(gestorBar, 'Bar')).toBe(true)
    expect(isManager(gestorBar, 'Cozinha')).toBe(false)
  })

  it('perfil de setor (sem gestão) nunca é manager', () => {
    const bartender = makeProfile({ role: 'bar', setor: 'Bar' })
    expect(isManager(bartender)).toBe(false)
    expect(isManager(bartender, 'Bar')).toBe(false)
  })
})
