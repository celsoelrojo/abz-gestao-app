import { useMemo, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { FREELANCERS_KEY, useFreelancers } from '../freelancer/useFreelancers'
import type { AuditLogRow, ProfileRow, Setor, UserRole } from '../../types/database'
import { summarizeProfileAudit } from './auditSummary'

const ROLE_OPTIONS: { value: UserRole; label: string; needsSetor: boolean }[] = [
  { value: 'administrador', label: 'Administrador', needsSetor: false },
  { value: 'gestor_bar', label: 'Gestor de Bar', needsSetor: true },
  { value: 'gestor_cozinha', label: 'Gestor de Cozinha', needsSetor: true },
  { value: 'gestor_salao', label: 'Gestor de Salão', needsSetor: true },
  { value: 'bar', label: 'Bartender', needsSetor: true },
  { value: 'cozinha', label: 'Cozinheiro', needsSetor: true },
  { value: 'salao', label: 'Atendente', needsSetor: true },
  { value: 'freelancer', label: 'Freelancer', needsSetor: true },
]
const ROLE_LABELS: Record<UserRole, string> = Object.fromEntries(ROLE_OPTIONS.map((r) => [r.value, r.label])) as Record<
  UserRole,
  string
>
const SETORES: Setor[] = ['Bar', 'Cozinha', 'Salão']

function needsSetorFor(role: UserRole) {
  return ROLE_OPTIONS.find((r) => r.value === role)?.needsSetor ?? true
}

// Exclusivo Administrador — a RLS de `profiles` (migration 0001) já barra
// qualquer outro perfil de ler/escrever conta alheia, mesmo que esta tela
// fosse acessada diretamente por alguém sem o link no menu.
export function ContasPage() {
  const queryClient = useQueryClient()
  const { data: contas, isLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('nome')
      if (error) throw error
      return data as ProfileRow[]
    },
  })

  const [showForm, setShowForm] = useState(false)
  const [nome, setNome] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('bar')
  const [setor, setSetor] = useState<Setor>('Bar')
  const [freelancerId, setFreelancerId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [editing, setEditing] = useState<ProfileRow | null>(null)
  const [resetting, setResetting] = useState<ProfileRow | null>(null)
  const [historyFor, setHistoryFor] = useState<ProfileRow | null>(null)

  const needsSetor = needsSetorFor(role)

  // Pedido do usuário: perfil de login pra freelancers. O cadastro em si (o
  // funcionário Freelancer > Cadastro de Freelancer) já existe sem conta —
  // aqui, ao criar a conta, o Administrador pode ligar essa conta a um
  // cadastro já existente (só os que ainda não têm conta vinculada, do
  // mesmo setor escolhido). Ligar é opcional: sem isso a conta funciona,
  // só que "Minha Escala" fica vazia até alguém vincular depois.
  const { data: freelancers } = useFreelancers()
  const freelancersDisponiveis = useMemo(
    () => (freelancers ?? []).filter((f) => f.setor === setor && !f.profile_id && f.status === 'ativo'),
    [freelancers, setor],
  )

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const { data: created, error: fnError } = await supabase.functions.invoke('manage-user', {
        body: { action: 'create', nome, username, password, role, setor: needsSetor ? setor : null },
      })
      if (fnError) {
        setError(fnError.message)
        return
      }
      if (role === 'freelancer' && freelancerId && created?.id) {
        const { error: linkError } = await supabase.from('freelancers').update({ profile_id: created.id }).eq('id', freelancerId)
        if (linkError) {
          // A conta já foi criada com sucesso — só a ligação falhou (ex.: o
          // cadastro foi vinculado por outro admin entre a busca e o clique
          // aqui). Avisa mas não desfaz a conta criada.
          setError(`Conta criada, mas não consegui vincular ao cadastro de freelancer: ${linkError.message}`)
          await queryClient.invalidateQueries({ queryKey: FREELANCERS_KEY })
          return
        }
        await queryClient.invalidateQueries({ queryKey: FREELANCERS_KEY })
      }
      setShowForm(false)
      setNome('')
      setUsername('')
      setPassword('')
      setFreelancerId('')
      await queryClient.invalidateQueries({ queryKey: ['profiles'] })
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleStatus(conta: ProfileRow) {
    const novoStatus = conta.status === 'ativa' ? 'bloqueada' : 'ativa'
    const { error } = await supabase.from('profiles').update({ status: novoStatus }).eq('id', conta.id)
    if (!error) queryClient.invalidateQueries({ queryKey: ['profiles'] })
  }

  return (
    <div className="container">
      <div className="checklist-header">
        <div>
          <h2 className="page-title">Gerenciar Contas</h2>
          <p className="page-subtitle">Usuários com acesso ao Abz Gestão</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancelar' : '+ Nova conta'}
        </button>
      </div>

      {showForm && (
        <form className="modal-body" onSubmit={handleCreate} style={{ marginBottom: 24 }}>
          <div className="field">
            <label>Nome completo *</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>
          <div className="field">
            <label>Usuário (login) *</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div className="field">
            <label>Senha inicial *</label>
            <input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="field">
            <label>Perfil *</label>
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value as UserRole)
                setFreelancerId('')
              }}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          {needsSetor && (
            <div className="field">
              <label>Setor *</label>
              <select
                value={setor}
                onChange={(e) => {
                  setSetor(e.target.value as Setor)
                  setFreelancerId('')
                }}
              >
                {SETORES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}
          {role === 'freelancer' && (
            <div className="field">
              <label>Vincular a um cadastro de freelancer</label>
              <select value={freelancerId} onChange={(e) => setFreelancerId(e.target.value)}>
                <option value="">Nenhum (vincular depois)</option>
                {freelancersDisponiveis.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome} · {f.funcao}
                  </option>
                ))}
              </select>
              <span className="field-hint">
                {freelancersDisponiveis.length === 0
                  ? `Nenhum freelancer ativo em ${setor} sem conta ainda. Pode cadastrar em Freelancer > Cadastro e vincular depois editando esta conta.`
                  : 'Sem isso, a conta funciona normalmente, mas "Minha Escala" fica vazia até vincular.'}
              </span>
            </div>
          )}
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Criando...' : 'Criar conta'}
          </button>
        </form>
      )}

      <div className="manage-list">
        {isLoading && <div className="empty-state">Carregando…</div>}
        {contas?.map((conta) => (
          <div className="manage-row" key={conta.id}>
            <div className="manage-row-info">
              <strong>{conta.nome}</strong>
              <span>
                {conta.username} · {ROLE_LABELS[conta.role]}
                {conta.setor ? ` · ${conta.setor}` : ''}
              </span>
              <div className="account-badges">
                <span
                  className={`badge-status ${
                    conta.status === 'ativa'
                      ? 'badge-status-ativa'
                      : conta.status === 'pendente'
                        ? 'badge-status-pendente'
                        : 'badge-status-bloqueada'
                  }`}
                >
                  {conta.status}
                </span>
              </div>
            </div>
            <div className="manage-row-actions">
              <button className="icon-btn" onClick={() => setHistoryFor(conta)} title="Histórico">
                🕘
              </button>
              <button className="icon-btn" onClick={() => setResetting(conta)} title="Redefinir senha">
                🔑
              </button>
              <button className="icon-btn" onClick={() => setEditing(conta)} title="Editar">
                ✎
              </button>
              <button className="icon-btn" onClick={() => toggleStatus(conta)} title={conta.status === 'ativa' ? 'Bloquear' : 'Ativar'}>
                {conta.status === 'ativa' ? '⏻' : '✓'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && <EditAccountModal conta={editing} onClose={() => setEditing(null)} />}
      {resetting && <ResetPasswordModal conta={resetting} onClose={() => setResetting(null)} />}
      {historyFor && <AccountHistoryModal conta={historyFor} onClose={() => setHistoryFor(null)} />}
    </div>
  )
}

function EditAccountModal({ conta, onClose }: { conta: ProfileRow; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [nome, setNome] = useState(conta.nome)
  const [role, setRole] = useState<UserRole>(conta.role)
  const [setor, setSetor] = useState<Setor>(conta.setor ?? 'Bar')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const needsSetor = needsSetorFor(role)

  // Mesmo vínculo opcional conta↔cadastro-de-freelancer do formulário de
  // criação, aqui pra quem pulou na criação (ou quer trocar/desvincular).
  const { data: freelancers } = useFreelancers()
  const freelancerAtual = useMemo(() => (freelancers ?? []).find((f) => f.profile_id === conta.id), [freelancers, conta.id])
  const [freelancerId, setFreelancerId] = useState(freelancerAtual?.id ?? '')
  const freelancersDisponiveis = useMemo(
    () =>
      (freelancers ?? []).filter(
        (f) => f.setor === setor && (!f.profile_id || f.id === freelancerAtual?.id) && f.status === 'ativo',
      ),
    [freelancers, setor, freelancerAtual],
  )

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      // RLS: profiles_admin_write (migration 0001) já garante que só um
      // Administrador chega até aqui de fato — sem Edge Function necessária.
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ nome, role, setor: needsSetor ? setor : null })
        .eq('id', conta.id)
      if (updateError) {
        setError(updateError.message)
        return
      }
      const novoVinculoId = role === 'freelancer' ? freelancerId || null : null
      if (novoVinculoId !== (freelancerAtual?.id ?? null)) {
        if (freelancerAtual) {
          await supabase.from('freelancers').update({ profile_id: null }).eq('id', freelancerAtual.id)
        }
        if (novoVinculoId) {
          const { error: linkError } = await supabase.from('freelancers').update({ profile_id: conta.id }).eq('id', novoVinculoId)
          if (linkError) {
            setError(`Conta salva, mas não consegui vincular ao cadastro de freelancer: ${linkError.message}`)
            await queryClient.invalidateQueries({ queryKey: FREELANCERS_KEY })
            return
          }
        }
        await queryClient.invalidateQueries({ queryKey: FREELANCERS_KEY })
      }
      await queryClient.invalidateQueries({ queryKey: ['profiles'] })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>Editar conta</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="field">
            <label>Nome completo *</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>
          <div className="field">
            <label>Perfil *</label>
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          {needsSetor && (
            <div className="field">
              <label>Setor *</label>
              <select value={setor} onChange={(e) => setSetor(e.target.value as Setor)}>
                {SETORES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}
          {role === 'freelancer' && (
            <div className="field">
              <label>Vincular a um cadastro de freelancer</label>
              <select value={freelancerId} onChange={(e) => setFreelancerId(e.target.value)}>
                <option value="">Nenhum</option>
                {freelancersDisponiveis.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome} · {f.funcao}
                  </option>
                ))}
              </select>
            </div>
          )}
          {error && <p className="login-error">{error}</p>}
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ResetPasswordModal({ conta, onClose }: { conta: ProfileRow; onClose: () => void }) {
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const { error: fnError } = await supabase.functions.invoke('manage-user', {
        body: { action: 'reset_password', userId: conta.id, newPassword },
      })
      if (fnError) {
        setError(fnError.message)
        return
      }
      setDone(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>Redefinir senha — {conta.nome}</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        {done ? (
          <div className="modal-body">
            <p>Senha redefinida com sucesso. Informe a nova senha para {conta.nome} por um canal seguro.</p>
            <div className="modal-footer">
              <button type="button" className="btn btn-primary" onClick={onClose}>
                Fechar
              </button>
            </div>
          </div>
        ) : (
          <form className="modal-body" onSubmit={handleSubmit}>
            <div className="field">
              <label>Nova senha *</label>
              <input
                type="password"
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <span className="field-hint">Mínimo 6 caracteres. A conta não é notificada automaticamente.</span>
            </div>
            {error && <p className="login-error">{error}</p>}
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Redefinindo...' : 'Redefinir'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function AccountHistoryModal({ conta, onClose }: { conta: ProfileRow; onClose: () => void }) {
  const { data: entries, isLoading } = useQuery({
    queryKey: ['profile-history', conta.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('table_name', 'profiles')
        .eq('record_id', conta.id)
        .order('changed_at', { ascending: false })
      if (error) throw error
      return data as AuditLogRow[]
    },
  })

  return (
    <div className="modal-overlay">
      <div className="modal modal-wide">
        <div className="modal-header">
          <h3>Histórico — {conta.nome}</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          {isLoading && <div className="empty-state">Carregando…</div>}
          {entries?.length === 0 && <div className="empty-state">Sem registros ainda.</div>}
          {entries?.map((entry) => (
            <div className="manage-row" key={entry.id}>
              <div className="manage-row-info">
                <strong>{summarizeProfileAudit(entry)}</strong>
                <span>
                  {entry.actor_nome ?? 'Sistema'} ·{' '}
                  {new Date(entry.changed_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
