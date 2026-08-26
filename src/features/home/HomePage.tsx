import { Link } from 'react-router-dom'
import { useAuthStore, isManager } from '../../store/authStore'

// Migração incremental e honesta: só os módulos com equivalente real no
// Supabase (Checklist, Contas, Impressão) ficam clicáveis aqui. O resto
// segue existindo no protótipo (abz-gestao/) até ganhar sua migração —
// nenhum módulo desaparece, só ainda não tem versão "de produção".
const MIGRATED_MODULES = [
  { key: 'checklist', to: '/checklist', title: 'Checklist', desc: 'Rotina diária do bar', roles: 'todos' as const },
  { key: 'contas', to: '/contas', title: 'Gerenciar Contas', desc: 'Usuários e acessos', roles: 'admin' as const },
  { key: 'impressao', to: '/impressao', title: 'Configuração de Impressora', desc: 'Etiquetas de produção', roles: 'manager' as const },
  { key: 'estoque', to: '/estoque', title: 'Estoque e Compras', desc: 'Saldo, entradas e retiradas', roles: 'todos' as const },
]

const PENDING_MODULES = ['Mapas e Fluxogramas', "POP's", 'Fichas Técnicas', 'Fichas de Produção', 'Reservas', 'Freelancer']

export function HomePage() {
  const profile = useAuthStore((s) => s.profile)
  const isAdmin = profile?.role === 'administrador'
  const managerAccess = isManager(profile)

  return (
    <div className="container">
      <h3 className="section-label">Módulos</h3>
      <div className="modules-grid">
        {MIGRATED_MODULES.filter((m) => m.roles === 'todos' || (m.roles === 'admin' && isAdmin) || (m.roles === 'manager' && managerAccess)).map(
          (m) => (
            <Link className="module-btn" to={m.to} key={m.key}>
              <span className="module-title">{m.title}</span>
              <span className="module-desc">{m.desc}</span>
            </Link>
          ),
        )}
      </div>

      <h3 className="section-label" style={{ marginTop: 28 }}>
        Ainda no protótipo (abz-gestao/) — ver README para o roteiro de migração
      </h3>
      <div className="modules-grid">
        {PENDING_MODULES.map((title) => (
          <div className="module-btn" style={{ opacity: 0.45, cursor: 'default' }} key={title}>
            <span className="module-title">{title}</span>
            <span className="module-desc">Em migração</span>
          </div>
        ))}
      </div>
    </div>
  )
}
