import { AUDIT_ACTION_LABELS, AUDIT_TABLE_LABELS } from './auditoriaConstants'
import type { AuditLogRow } from '../../types/database'

export function AuditLogDetailModal({ entry, onClose }: { entry: AuditLogRow; onClose: () => void }) {
  return (
    <div className="modal-overlay">
      <div className="modal modal-wide">
        <div className="modal-header">
          <h3>{AUDIT_TABLE_LABELS[entry.table_name] ?? entry.table_name}</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="account-badges" style={{ marginBottom: 12 }}>
            <span className="badge-status badge-status-pendente">{AUDIT_ACTION_LABELS[entry.action] ?? entry.action}</span>
          </div>
          <p className="field-hint">
            {entry.actor_nome ?? 'Desconhecido'} · {new Date(entry.changed_at).toLocaleString('pt-BR')} · registro {entry.record_id}
          </p>

          {entry.old_data && (
            <>
              <h4 className="section-label">Antes</h4>
              <pre className="audit-json-block">{JSON.stringify(entry.old_data, null, 2)}</pre>
            </>
          )}
          {entry.new_data && (
            <>
              <h4 className="section-label">Depois</h4>
              <pre className="audit-json-block">{JSON.stringify(entry.new_data, null, 2)}</pre>
            </>
          )}

          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose}>
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
