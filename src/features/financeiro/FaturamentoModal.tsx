import { useState } from 'react'
import { formatDateBR, weekdayNameForDate } from '../../lib/date'
import { listarDias, semanaDe } from './cmvHelpers'
import { formatBRL, parseValorBR, somarDias } from './contaHelpers'
import { salvarFaturamentoDias, useFaturamento } from './useCmv'

const paraTexto = (v: number) => v.toFixed(2).replace('.', ',')

// Faturamento digitado dia a dia, uma semana por vez (segunda a domingo).
// Campo vazio = sem lançamento; 0 = dia fechado ou sem movimento.
export function FaturamentoModal({
  inicialIso,
  onClose,
  onSaved,
}: {
  inicialIso: string
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [semanaRef, setSemanaRef] = useState(inicialIso)
  const semana = semanaDe(semanaRef)
  const dias = listarDias(semana)
  const { data: lancados, isLoading } = useFaturamento(semana)
  // Só o que a pessoa digitou; o resto vem do banco. Guardado por data, então
  // trocar de semana não perde o que já foi digitado.
  const [edicoes, setEdicoes] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const doBanco = new Map((lancados ?? []).map((l) => [l.data, l.valor]))
  const textoDoDia = (d: string) => edicoes[d] ?? (doBanco.has(d) ? paraTexto(doBanco.get(d)!) : '')
  const totalSemana = dias.reduce((s, d) => s + (parseValorBR(textoDoDia(d)) ?? 0), 0)
  const qtdEdicoes = Object.keys(edicoes).length

  async function salvar() {
    setError(null)
    const linhas: { data: string; valor: number | null }[] = []
    for (const [data, texto] of Object.entries(edicoes)) {
      if (!texto.trim()) {
        linhas.push({ data, valor: null })
        continue
      }
      const valor = parseValorBR(texto)
      if (valor == null) return setError(`Valor inválido em ${formatDateBR(data)}.`)
      linhas.push({ data, valor })
    }
    setSubmitting(true)
    try {
      await salvarFaturamentoDias(linhas)
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar o faturamento.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal modal-wide">
        <div className="modal-header">
          <h3>Faturamento</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setSemanaRef(somarDias(semana.inicio, -7))}>
              ← Anterior
            </button>
            <strong style={{ textAlign: 'center' }}>
              {formatDateBR(semana.inicio)} a {formatDateBR(semana.fim)}
            </strong>
            <button type="button" className="btn btn-ghost" onClick={() => setSemanaRef(somarDias(semana.inicio, 7))}>
              Próxima →
            </button>
          </div>
          <p className="field-hint">
            O dia vai das 5h às 5h: o que entrou depois da meia-noite conta no dia anterior. Deixe em branco o que não foi
            lançado; digite 0 para dia fechado.
          </p>

          {isLoading ? (
            <div className="empty-state">Carregando…</div>
          ) : (
            <div className="manage-list">
              {dias.map((d) => (
                <div className="manage-row" key={d} style={{ alignItems: 'center', gap: 12 }}>
                  <div className="manage-row-info">
                    <strong>{weekdayNameForDate(new Date(`${d}T00:00:00`))}</strong>
                    <span>{formatDateBR(d)}</span>
                  </div>
                  <input
                    inputMode="decimal"
                    placeholder="R$ 0,00"
                    value={textoDoDia(d)}
                    onChange={(e) => setEdicoes((prev) => ({ ...prev, [d]: e.target.value }))}
                    aria-label={`Faturamento de ${formatDateBR(d)}`}
                    style={{ maxWidth: 150, textAlign: 'right' }}
                  />
                </div>
              ))}
            </div>
          )}

          <p style={{ textAlign: 'right', margin: '12px 0 0' }}>
            <strong>Total da semana: {formatBRL(totalSemana)}</strong>
          </p>

          {error && <p className="login-error">{error}</p>}

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" disabled={submitting || qtdEdicoes === 0} onClick={salvar}>
              {submitting ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
