import type { AuditLogRow } from '../../types/database'

const FIELD_LABELS: Record<string, string> = {
  nome: 'nome',
  role: 'perfil',
  setor: 'setor',
  status: 'status',
  username: 'usuário',
}

// Reduz um registro de audit_log (INSERT/UPDATE/DELETE genérico, com o
// before/after inteiro da linha) numa frase curta em PT-BR pro histórico da
// conta. Só compara os campos que fazem sentido mostrar pro Administrador —
// colunas técnicas como updated_at não entram no resumo.
export function summarizeProfileAudit(row: Pick<AuditLogRow, 'action' | 'old_data' | 'new_data'>): string {
  if (row.action === 'INSERT') return 'Conta criada'
  if (row.action === 'DELETE') return 'Conta excluída'

  const before = row.old_data ?? {}
  const after = row.new_data ?? {}
  const changes = Object.entries(FIELD_LABELS)
    .filter(([field]) => before[field] !== after[field])
    .map(([field, label]) => `${label}: ${before[field] ?? '—'} → ${after[field] ?? '—'}`)

  return changes.length > 0 ? changes.join(', ') : 'Atualização sem mudanças relevantes'
}
