import { useState } from 'react'
import { AUDIT_ACTION_LABELS, AUDIT_TABLE_LABELS, AUDIT_TABLES } from './auditoriaConstants'
import { summarizeAudit } from './auditoriaHelpers'
import { useAuditLog, type AuditLogFilters } from './useAuditLog'
import { AuditLogDetailModal } from './AuditLogDetailModal'
import type { AuditLogRow } from '../../types/database'

const FILTROS_INICIAIS: AuditLogFilters = { tableName: '', action: '', actorNome: '', dataInicio: '', dataFim: '' }

export function AuditoriaPage() {
  const [filtros, setFiltros] = useState<AuditLogFilters>(FILTROS_INICIAIS)
  const { data, isLoading } = useAuditLog(filtros)
  const [detalhe, setDetalhe] = useState<AuditLogRow | null>(null)

  function setFiltro<K extends keyof AuditLogFilters>(key: K, value: AuditLogFilters[K]) {
    setFiltros((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="container">
      <div className="checklist-header">
        <div>
          <h2 className="page-title">Histórico de Auditoria</h2>
          <p className="page-subtitle">Toda alteração feita nas tabelas críticas — quem, quando e o que mudou</p>
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label>Tabela</label>
          <select value={filtros.tableName} onChange={(e) => setFiltro('tableName', e.target.value)}>
            <option value="">Todas</option>
            {AUDIT_TABLES.map((t) => (
              <option key={t} value={t}>
                {AUDIT_TABLE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Ação</label>
          <select value={filtros.action} onChange={(e) => setFiltro('action', e.target.value)}>
            <option value="">Todas</option>
            {Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field-row">
        <div className="field" style={{ flex: 1 }}>
          <label>Responsável</label>
          <input value={filtros.actorNome} onChange={(e) => setFiltro('actorNome', e.target.value)} placeholder="Nome..." />
        </div>
        <div className="field">
          <label>De</label>
          <input type="date" value={filtros.dataInicio} onChange={(e) => setFiltro('dataInicio', e.target.value)} />
        </div>
        <div className="field">
          <label>Até</label>
          <input type="date" value={filtros.dataFim} onChange={(e) => setFiltro('dataFim', e.target.value)} />
        </div>
      </div>

      {isLoading && <div className="empty-state">Carregando…</div>}
      <div className="manage-list" style={{ marginTop: 16 }}>
        {data?.length === 0 && !isLoading && <div className="empty-state">Nenhum registro encontrado.</div>}
        {data?.map((entry) => (
          <button
            className="manage-row"
            key={entry.id}
            onClick={() => setDetalhe(entry)}
            style={{ textAlign: 'left', width: '100%', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <div className="manage-row-info">
              <strong>{AUDIT_TABLE_LABELS[entry.table_name] ?? entry.table_name}</strong>
              <span style={{ display: 'block' }}>
                {entry.actor_nome ?? 'Desconhecido'} · {new Date(entry.changed_at).toLocaleString('pt-BR')}
              </span>
              <span style={{ display: 'block' }}>{summarizeAudit(entry)}</span>
            </div>
            <div className="account-badges">
              <span
                className={`badge-status ${
                  entry.action === 'INSERT' ? 'badge-status-ativa' : entry.action === 'DELETE' ? 'badge-status-bloqueada' : 'badge-status-pendente'
                }`}
              >
                {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
              </span>
            </div>
          </button>
        ))}
      </div>
      {data && data.length === 200 && (
        <p className="field-hint" style={{ marginTop: 12 }}>
          Mostrando as 200 alterações mais recentes para este filtro — refine a busca pra ver além disso.
        </p>
      )}

      {detalhe && <AuditLogDetailModal entry={detalhe} onClose={() => setDetalhe(null)} />}
    </div>
  )
}
