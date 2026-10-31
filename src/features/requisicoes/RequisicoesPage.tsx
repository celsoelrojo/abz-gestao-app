import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isFullAdmin, isManager, useAuthStore } from '../../store/authStore'
import { confirmar } from '../../store/confirmStore'
import { Icon } from '../../components/Icon'
import {
  REQUISICAO_STATUS_BADGE_CLASS,
  REQUISICAO_STATUS_LABELS,
  REQUISICAO_TIPOS,
  REQUISICAO_TIPO_LABELS,
  REQUISICAO_URGENCIA_BADGE_CLASS,
  REQUISICAO_URGENCIA_LABELS,
} from './requisicaoConstants'
import { ordenarAbertas, ordenarEncerradas, podeEditarRequisicao, requisicaoAberta } from './requisicaoHelpers'
import {
  REQUISICOES_KEY,
  decidirRequisicao,
  excluirRequisicao,
  useRequisicaoFotoUrl,
  useRequisicoes,
  useRequisicoesRealtime,
} from './useRequisicoes'
import { RequisicaoFormModal } from './RequisicaoFormModal'
import type { RequisicaoRow, RequisicaoStatus, RequisicaoTipo } from '../../types/database'

const dataBR = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')

export function RequisicoesPage() {
  const profile = useAuthStore((s) => s.profile)
  const admin = isFullAdmin(profile)
  // Gestor e Administrador veem requisições de outras pessoas — só então vale
  // mostrar quem pediu.
  const veOutros = isManager(profile)
  const queryClient = useQueryClient()

  const { data: requisicoes, isLoading } = useRequisicoes()
  useRequisicoesRealtime()

  const [aba, setAba] = useState<'abertas' | 'encerradas'>('abertas')
  const [filtroTipo, setFiltroTipo] = useState<RequisicaoTipo | 'Todos'>('Todos')
  const [busca, setBusca] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<RequisicaoRow | null>(null)
  const [recusando, setRecusando] = useState<RequisicaoRow | null>(null)

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return (requisicoes ?? [])
      .filter((r) => filtroTipo === 'Todos' || r.tipo === filtroTipo)
      .filter(
        (r) =>
          !termo ||
          r.titulo.toLowerCase().includes(termo) ||
          (r.descricao ?? '').toLowerCase().includes(termo) ||
          r.solicitante_nome.toLowerCase().includes(termo),
      )
  }, [requisicoes, filtroTipo, busca])

  const abertas = useMemo(() => ordenarAbertas(filtradas.filter((r) => requisicaoAberta(r.status))), [filtradas])
  const encerradas = useMemo(() => ordenarEncerradas(filtradas.filter((r) => !requisicaoAberta(r.status))), [filtradas])
  const lista = aba === 'abertas' ? abertas : encerradas

  async function recarregar() {
    await queryClient.invalidateQueries({ queryKey: REQUISICOES_KEY })
  }

  async function mudarStatus(r: RequisicaoRow, status: RequisicaoStatus, pergunta?: string) {
    if (pergunta && !(await confirmar(pergunta))) return
    try {
      await decidirRequisicao(r.id, status)
      await recarregar()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Erro ao atualizar a requisição.')
    }
  }

  async function excluir(r: RequisicaoRow) {
    const msg = admin ? `Excluir a requisição "${r.titulo}"? Esta ação não pode ser desfeita.` : `Cancelar a requisição "${r.titulo}"?`
    if (!(await confirmar(msg))) return
    try {
      await excluirRequisicao(r)
      await recarregar()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Erro ao excluir a requisição.')
    }
  }

  if (isLoading) return <div className="empty-state">Carregando…</div>

  return (
    <div className="container">
      <div className="checklist-header">
        <div>
          <h2 className="page-title">Requisição</h2>
          <p className="page-subtitle">Pedidos de compra e de conserto fora da rotina</p>
        </div>
      </div>

      <div className="quick-actions">
        <button
          type="button"
          className={`quick-btn ${aba === 'abertas' ? 'quick-btn-active' : ''}`}
          onClick={() => setAba('abertas')}
        >
          <Icon name="requisicao-abertas" className="quick-icon" />
          <span className="quick-label">Abertas ({abertas.length})</span>
        </button>
        <button type="button" className="quick-btn" onClick={() => setCreating(true)}>
          <Icon name="requisicao-nova" className="quick-icon" />
          <span className="quick-label">Nova Requisição</span>
        </button>
        <button
          type="button"
          className={`quick-btn ${aba === 'encerradas' ? 'quick-btn-active' : ''}`}
          onClick={() => setAba('encerradas')}
        >
          <Icon name="requisicao-encerradas" className="quick-icon" />
          <span className="quick-label">Encerradas ({encerradas.length})</span>
        </button>
      </div>

      <div className="reserva-filters">
        <input type="text" placeholder="Buscar requisição..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value as RequisicaoTipo | 'Todos')}>
          <option value="Todos">Todos os tipos</option>
          {REQUISICAO_TIPOS.map((t) => (
            <option key={t} value={t}>
              {REQUISICAO_TIPO_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <h3 className="section-label">{aba === 'abertas' ? 'Abertas' : 'Encerradas'}</h3>

      {lista.length === 0 && (
        <div className="empty-state">
          {aba === 'abertas' ? 'Nenhuma requisição aberta.' : 'Nenhuma requisição encerrada.'}
        </div>
      )}

      <div className="manage-list">
        {lista.map((r) => (
          <RequisicaoCard
            key={r.id}
            r={r}
            mostrarSolicitante={veOutros}
            admin={admin}
            podeEditar={podeEditarRequisicao(profile, r)}
            onEditar={() => setEditing(r)}
            onExcluir={() => excluir(r)}
            onAprovar={() => mudarStatus(r, 'aprovada')}
            onRecusar={() => setRecusando(r)}
            onConcluir={() => mudarStatus(r, 'concluida')}
            onReabrir={() => mudarStatus(r, 'pendente', `Reabrir a requisição "${r.titulo}" como pendente?`)}
          />
        ))}
      </div>

      {(creating || editing) && (
        <RequisicaoFormModal
          requisicao={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={async () => {
            setCreating(false)
            setEditing(null)
            await recarregar()
          }}
        />
      )}

      {recusando && (
        <RecusaModal
          requisicao={recusando}
          onClose={() => setRecusando(null)}
          onDone={async () => {
            setRecusando(null)
            await recarregar()
          }}
        />
      )}
    </div>
  )
}

function RequisicaoCard({
  r,
  mostrarSolicitante,
  admin,
  podeEditar,
  onEditar,
  onExcluir,
  onAprovar,
  onRecusar,
  onConcluir,
  onReabrir,
}: {
  r: RequisicaoRow
  mostrarSolicitante: boolean
  admin: boolean
  podeEditar: boolean
  onEditar: () => void
  onExcluir: () => void
  onAprovar: () => void
  onRecusar: () => void
  onConcluir: () => void
  onReabrir: () => void
}) {
  const [fotoAberta, setFotoAberta] = useState(false)
  const quem = [r.solicitante_nome, r.setor].filter(Boolean).join(' · ')

  return (
    <div className="manage-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div className="manage-row-info">
        <strong>{r.titulo}</strong>
        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '4px 0' }}>
          <span className="badge-status badge-status-pendente">{REQUISICAO_TIPO_LABELS[r.tipo]}</span>
          <span className={`badge-status ${REQUISICAO_URGENCIA_BADGE_CLASS[r.urgencia]}`}>
            Urgência {REQUISICAO_URGENCIA_LABELS[r.urgencia].toLowerCase()}
          </span>
          <span className={`badge-status ${REQUISICAO_STATUS_BADGE_CLASS[r.status]}`}>{REQUISICAO_STATUS_LABELS[r.status]}</span>
        </span>
        {r.descricao && <span style={{ display: 'block', whiteSpace: 'pre-wrap' }}>{r.descricao}</span>}
        <span style={{ display: 'block' }}>
          {mostrarSolicitante && quem ? `${quem} · ` : ''}
          {dataBR(r.created_at)}
        </span>
        {r.decidido_por_nome && r.decidido_em && (
          <span style={{ display: 'block' }}>
            {REQUISICAO_STATUS_LABELS[r.status]} por {r.decidido_por_nome} em {dataBR(r.decidido_em)}
          </span>
        )}
        {r.status === 'recusada' && r.motivo_recusa && <span style={{ display: 'block' }}>Motivo: {r.motivo_recusa}</span>}
        {r.foto_path && (
          <button type="button" className="btn btn-ghost" style={{ marginTop: 6 }} onClick={() => setFotoAberta(true)}>
            Ver foto
          </button>
        )}
      </div>

      <div className="manage-row-actions" style={{ flexWrap: 'wrap' }}>
        {admin && r.status === 'pendente' && (
          <>
            <button className="btn btn-primary" onClick={onAprovar}>
              Aprovar
            </button>
            <button className="btn btn-ghost" onClick={onRecusar}>
              Recusar
            </button>
          </>
        )}
        {admin && r.status === 'aprovada' && (
          <button className="btn btn-primary" onClick={onConcluir}>
            Marcar concluída
          </button>
        )}
        {admin && (r.status === 'concluida' || r.status === 'recusada') && (
          <button className="btn btn-ghost" onClick={onReabrir}>
            Reabrir
          </button>
        )}
        {podeEditar && (
          <button className="icon-btn" title="Editar" onClick={onEditar}>
            ✎
          </button>
        )}
        {podeEditar && (
          <button className="icon-btn danger" title={admin ? 'Excluir' : 'Cancelar requisição'} onClick={onExcluir}>
            🗑
          </button>
        )}
      </div>

      {fotoAberta && r.foto_path && <FotoModal path={r.foto_path} titulo={r.titulo} onClose={() => setFotoAberta(false)} />}
    </div>
  )
}

function FotoModal({ path, titulo, onClose }: { path: string; titulo: string; onClose: () => void }) {
  const { data: url, isLoading, isError } = useRequisicaoFotoUrl(path)
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{titulo}</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          {isLoading && <div className="empty-state">Carregando…</div>}
          {isError && <div className="empty-state">Não foi possível carregar a foto.</div>}
          {url && <img src={url} alt={titulo} style={{ maxWidth: '100%', borderRadius: 8, display: 'block', margin: '0 auto' }} />}
        </div>
      </div>
    </div>
  )
}

function RecusaModal({
  requisicao,
  onClose,
  onDone,
}: {
  requisicao: RequisicaoRow
  onClose: () => void
  onDone: () => Promise<void>
}) {
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function recusar() {
    if (!motivo.trim()) {
      setError('Informe o motivo da recusa.')
      return
    }
    setSubmitting(true)
    try {
      await decidirRequisicao(requisicao.id, 'recusada', motivo)
      await onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao recusar a requisição.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>Recusar requisição</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p>{requisicao.titulo}</p>
          <div className="field">
            <label>Motivo da recusa *</label>
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} autoFocus />
            <span className="field-hint">O solicitante vê este motivo na requisição.</span>
          </div>
          {error && <p className="login-error">{error}</p>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>
            Voltar
          </button>
          <button className="btn btn-primary" onClick={recusar} disabled={submitting}>
            {submitting ? 'Recusando...' : 'Recusar'}
          </button>
        </div>
      </div>
    </div>
  )
}
