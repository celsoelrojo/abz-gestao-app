import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import type { ProfileRow } from '../types/database'

// Equivalente a state.currentUser do protótipo — a diferença é que role/setor
// aqui vêm de uma linha real em `profiles`, protegida por RLS, e não de um
// objeto local que qualquer código no browser poderia alterar.
interface AuthState {
  session: Session | null
  profile: ProfileRow | null
  loading: boolean
  setSession: (session: Session | null) => void
  setProfile: (profile: ProfileRow | null) => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  loading: true,
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),
}))

// Helpers de permissão — mesma semântica de isFullAdmin()/isSetorManager()/
// isManager(setor) do protótipo (script.js), só que lendo do profile real.
// Servem só pra UI (mostrar/esconder); a permissão de verdade é sempre a RLS
// no banco — nunca confiar só nestas funções.
export function isFullAdmin(profile: ProfileRow | null): boolean {
  return profile?.role === 'administrador'
}

const SETOR_MANAGER_ROLES = new Set(['gestor_bar', 'gestor_cozinha', 'gestor_salao'])

export function isSetorManager(profile: ProfileRow | null): boolean {
  return !!profile && SETOR_MANAGER_ROLES.has(profile.role)
}

export function isManager(profile: ProfileRow | null, targetSetor?: string | null): boolean {
  if (isFullAdmin(profile)) return true
  if (isSetorManager(profile)) return !targetSetor || profile?.setor === targetSetor
  return false
}

export function isFreelancer(profile: ProfileRow | null): boolean {
  return profile?.role === 'freelancer'
}
