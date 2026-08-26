import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'

// Mesma UX do protótipo (login por "usuário", não e-mail) — por baixo,
// resolve o username pra e-mail via a função email_for_username (migration
// 0001) e autentica de verdade contra o Supabase Auth.
export function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const { data: email, error: lookupError } = await supabase.rpc('email_for_username', {
        p_username: username.trim(),
      })
      if (lookupError || !email) {
        setError('Usuário ou senha inválidos.')
        return
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        setError('Usuário ou senha inválidos.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="view view-login active">
      <div className="login-backdrop" />
      <div className="login-card">
        <div className="brand">
          <div className="brand-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 12C8 6 2 8 4 12 2 16 8 18 12 12Z" />
              <path d="M12 12C16 6 22 8 20 12 22 16 16 18 12 12Z" />
            </svg>
          </div>
          <h1 className="brand-name">
            Abz <span>Gestão</span>
          </h1>
          <p className="brand-tagline">Gestão operacional do seu bar</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="login-username">Usuário</label>
            <input
              id="login-username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="login-password">Senha</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </section>
  )
}
