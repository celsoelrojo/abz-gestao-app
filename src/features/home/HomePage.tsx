import { Link } from 'react-router-dom'
import { useAuthStore, isManager } from '../../store/authStore'
import { MensagensImportantesPanel } from '../mensagens/MensagensImportantesPanel'

// Migração incremental e honesta: só os módulos com equivalente real no
// Supabase (Checklist, Contas, Impressão) ficam clicáveis aqui. O resto
// segue existindo no protótipo (abz-gestao/) até ganhar sua migração —
// nenhum módulo desaparece, só ainda não tem versão "de produção".
const MIGRATED_MODULES = [
  { key: 'checklist', to: '/checklist', title: 'Checklist', desc: 'Rotina diária do bar', roles: 'todos' as const },
  { key: 'contas', to: '/contas', title: 'Gerenciar Contas', desc: 'Usuários e acessos', roles: 'admin' as const },
  { key: 'impressao', to: '/impressao', title: 'Configuração de Impressora', desc: 'Etiquetas de produção', roles: 'manager' as const },
  { key: 'estoque', to: '/estoque', title: 'Estoque e Compras', desc: 'Saldo, entradas e retiradas', roles: 'todos' as const },
  // Igual ao protótipo (MODULE_ACCESS.reservas): só Administrador e o setor
  // Salão (Gestor ou Atendente) — Bar/Cozinha nunca acessam este módulo.
  { key: 'reservas', to: '/reservas', title: 'Reservas', desc: 'Agenda do salão', roles: 'salao' as const },
  // Bar/Cozinha só (nunca Salão) — igual ao protótipo (getVinculoOptions só
  // busca fichas nesses dois setores).
  {
    key: 'fichas-tecnicas',
    to: '/fichas-tecnicas',
    title: 'Fichas Técnicas',
    desc: 'Receitas, custos e modo de preparo',
    roles: 'bar_cozinha' as const,
  },
  {
    key: 'fichas-producao',
    to: '/fichas-producao',
    title: 'Fichas de Produção',
    desc: 'Produção em lote, validade e etiquetas',
    roles: 'bar_cozinha' as const,
  },
  { key: 'mapas', to: '/mapas', title: 'Mapas e Fluxogramas', desc: 'Layout do ambiente e fluxos de processo', roles: 'todos' as const },
  // Igual ao protótipo (MODULE_ACCESS.freelancer = ['administrador']) — o
  // único módulo restrito só ao Administrador, sem exceção pra Gestor.
  { key: 'freelancer', to: '/freelancer', title: 'Freelancer', desc: 'Cadastro e escala de freelancers', roles: 'admin' as const },
  { key: 'pops', to: '/pops', title: "POP's", desc: 'Procedimentos Operacionais Padrão', roles: 'todos' as const },
]

const PENDING_MODULES: string[] = []

export function HomePage() {
  const profile = useAuthStore((s) => s.profile)
  const isAdmin = profile?.role === 'administrador'
  const managerAccess = isManager(profile)
  const salaoAccess = isAdmin || profile?.setor === 'Salão'
  const barCozinhaAccess = isAdmin || profile?.setor === 'Bar' || profile?.setor === 'Cozinha'

  return (
    <div className="container">
      <MensagensImportantesPanel />

      <h3 className="section-label">Módulos</h3>
      <div className="modules-grid">
        {MIGRATED_MODULES.filter(
          (m) =>
            m.roles === 'todos' ||
            (m.roles === 'admin' && isAdmin) ||
            (m.roles === 'manager' && managerAccess) ||
            (m.roles === 'salao' && salaoAccess) ||
            (m.roles === 'bar_cozinha' && barCozinhaAccess),
        ).map((m) => (
          <Link className="module-btn" to={m.to} key={m.key}>
            <span className="module-title">{m.title}</span>
            <span className="module-desc">{m.desc}</span>
          </Link>
        ))}
      </div>

      {PENDING_MODULES.length > 0 && (
        <>
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
        </>
      )}
    </div>
  )
}
