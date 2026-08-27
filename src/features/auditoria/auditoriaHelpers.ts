import type { AuditLogRow } from '../../types/database'

// Colunas técnicas que nunca ajudam a entender "o que mudou" — omitidas do
// resumo genérico (diferente de summarizeProfileAudit, que é específico de
// Contas com labels manuais; aqui cobre as 10 tabelas auditadas sem precisar
// de uma lista de campos por tabela).
const CAMPOS_IGNORADOS = new Set(['id', 'created_at', 'updated_at'])

function formatarValor(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'object') {
    const json = JSON.stringify(v)
    return json.length > 60 ? `${json.slice(0, 60)}…` : json
  }
  return String(v)
}

// Resume um registro de audit_log numa lista curta de mudanças em PT-BR.
export function summarizeAudit(row: Pick<AuditLogRow, 'action' | 'old_data' | 'new_data'>): string {
  if (row.action === 'INSERT') return 'Registro criado'
  if (row.action === 'DELETE') return 'Registro excluído'

  const before = (row.old_data ?? {}) as Record<string, unknown>
  const after = (row.new_data ?? {}) as Record<string, unknown>
  const campos = new Set([...Object.keys(before), ...Object.keys(after)])

  const mudancas = [...campos]
    .filter((campo) => !CAMPOS_IGNORADOS.has(campo))
    .filter((campo) => JSON.stringify(before[campo]) !== JSON.stringify(after[campo]))
    .map((campo) => `${campo}: ${formatarValor(before[campo])} → ${formatarValor(after[campo])}`)

  return mudancas.length > 0 ? mudancas.join(' · ') : 'Atualização sem mudanças relevantes'
}
