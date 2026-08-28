import { Link } from 'react-router-dom'
import { useAuthStore, isManager } from '../../store/authStore'
import { Icon, type IconName } from '../../components/Icon'
import { useChecklistRealtime } from '../checklist/useChecklistTasks'
import { MensagensImportantesPanel } from '../mensagens/MensagensImportantesPanel'
import { TarefasProgressoCard } from './TarefasProgressoCard'
import { useChecklistResumoDia } from './useChecklistResumoDia'

// Migração incremental e honesta: só os módulos com equivalente real no
// Supabase (Checklist, Contas, Impressão) ficam clicáveis aqui. O resto
// segue existindo no protótipo (abz-gestao/) até ganhar sua migração —
// nenhum módulo desaparece, só ainda não tem versão "de produção".
const MIGRATED_MODULES: { key: string; to: string; title: string; desc: string; icon: IconName; roles: string }[] = [
  { key: 'checklist', to: '/checklist', title: 'Checklist', desc: 'Rotina diária do bar', icon: 'checklist', roles: 'todos' },
  { key: 'estoque', to: '/estoque', title: 'Estoque e Compras', desc: 'Saldo, entradas e retiradas', icon: 'estoque', roles: 'todos' },
  // Igual ao protótipo (MODULE_ACCESS.reservas): só Administrador e o setor
  // Salão (Gestor ou Atendente) — Bar/Cozinha nunca acessam este módulo.
  { key: 'reservas', to: '/reservas', title: 'Reservas', desc: 'Agenda do salão', icon: 'reservas', roles: 'salao' },
  // Bar/Cozinha só (nunca Salão) — igual ao protótipo (getVinculoOptions só
  // busca fichas nesses dois setores).
  {
    key: 'fichas-tecnicas',
    to: '/fichas-tecnicas',
    title: 'Fichas Técnicas',
    desc: 'Receitas, custos e modo de preparo',
    icon: 'fichas-tecnicas',
    roles: 'bar_cozinha',
  },
  {
    key: 'fichas-producao',
    to: '/fichas-producao',
    title: 'Fichas de Produção',
    desc: 'Produção em lote, validade e etiquetas',
    icon: 'fichas-producao',
    roles: 'bar_cozinha',
  },
  { key: 'pops', to: '/pops', title: "POP's", desc: 'Procedimentos Operacionais Padrão', icon: 'pops', roles: 'todos' },
  { key: 'mapas', to: '/mapas', title: 'Mapas e Fluxogramas', desc: 'Layout do ambiente e fluxos de processo', icon: 'mapas', roles: 'todos' },
  // Igual ao protótipo (MODULE_ACCESS.freelancer = ['administrador']) — o
  // único módulo restrito só ao Administrador, sem exceção pra Gestor.
  { key: 'freelancer', to: '/freelancer', title: 'Freelancer', desc: 'Cadastro e escala de freelancers', icon: 'freelancer', roles: 'admin' },
  { key: 'contas', to: '/contas', title: 'Gerenciar Contas', desc: 'Usuários e acessos', icon: 'accounts', roles: 'admin' },
  { key: 'impressao', to: '/impressao', title: 'Configuração de Impressora', desc: 'Etiquetas de produção', icon: 'gear', roles: 'manager' },
  { key: 'auditoria', to: '/auditoria', title: 'Histórico de Auditoria', desc: 'Quem alterou o quê e quando', icon: 'auditoria', roles: 'admin' },
]

const PENDING_MODULES: string[] = []

export function HomePage() {
  const profile = useAuthStore((s) => s.profile)
  const isAdmin = profile?.role === 'administrador'
  const managerAccess = isManager(profile)
  const salaoAccess = isAdmin || profile?.setor === 'Salão'
  const barCozinhaAccess = isAdmin || profile?.setor === 'Bar' || profile?.setor === 'Cozinha'

  useChecklistRealtime()
  const { data: resumoDia } = useChecklistResumoDia()

  return (
    <div className="container">
      <MensagensImportantesPanel />

      {resumoDia && (
        <div className="home-progress-row">
          <TarefasProgressoCard titulo="Tarefas do dia — Geral" resumo={resumoDia.geral} mostrarFraseIncentivo />
          {profile?.setor && (
            <TarefasProgressoCard
              titulo={`Tarefas do dia — ${profile.setor}`}
              resumo={resumoDia.porSetor[profile.setor]}
            />
          )}
        </div>
      )}

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
            <Icon name={m.icon} className="module-icon" />
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
