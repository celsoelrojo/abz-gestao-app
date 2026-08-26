import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuthStore } from '../store/authStore'

const ROLE_LABELS: Record<string, string> = {
  administrador: 'Administrador',
  gestor_bar: 'Gestor de Bar',
  gestor_cozinha: 'Gestor de Cozinha',
  gestor_salao: 'Gestor de Salão',
  bar: 'Bartender',
  cozinha: 'Cozinheiro',
  salao: 'Atendente',
}

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function TopBar() {
  const profile = useAuthStore((s) => s.profile)

  return (
    <header className="topbar">
      <div className="topbar-left">
        <Link to="/" className="icon-link" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="brand-icon small">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 12C8 6 2 8 4 12 2 16 8 18 12 12Z" />
              <path d="M12 12C16 6 22 8 20 12 22 16 16 18 12 12Z" />
            </svg>
          </span>
          <span className="topbar-title">
            Abz <span>Gestão</span>
          </span>
        </Link>
      </div>
      <div className="topbar-right">
        {profile && (
          <div className="user-chip">
            <span className="user-avatar">{initials(profile.nome)}</span>
            <span className="user-meta">
              <strong>{profile.nome}</strong>
              <span className="role-badge">{ROLE_LABELS[profile.role] ?? profile.role}</span>
            </span>
          </div>
        )}
        <button className="btn btn-ghost" onClick={() => supabase.auth.signOut()}>
          Sair
        </button>
      </div>
    </header>
  )
}
