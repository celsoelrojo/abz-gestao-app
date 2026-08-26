import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

// Isto é só conveniência de navegação — NUNCA a barreira de segurança real.
// A barreira real é a RLS no banco: mesmo se alguém forçasse a rota, toda
// query só devolve o que a policy da tabela permitir pra aquele usuário.
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const session = useAuthStore((s) => s.session)
  const loading = useAuthStore((s) => s.loading)

  if (loading) return <div className="soon-box">Carregando…</div>
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}
