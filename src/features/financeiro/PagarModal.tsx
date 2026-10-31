import { useState, type FormEvent } from 'react'
import { isoDate } from '../../lib/date'
import { FORMAS_PAGAMENTO } from './financeiroConstants'
import { formatBRL, parseValorBR } from './contaHelpers'
import { registrarPagamento } from './useContasPagar'
import type { ContaPagarRow } from '../../types/database'

// "Marcar como paga": data e valor pré-preenchidos (hoje / valor da conta) —
// o valor pode diferir (juros, desconto), por isso é editável.
export function PagarModal({
  conta,
  onClose,
  onSaved,
}: {
  conta: ContaPagarRow
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [pagoEm, setPagoEm] = useState(isoDate(new Date()))
  const [valorTexto, setValorTexto] = useState(conta.valor.toFixed(2).replace('.', ','))
  const [forma, setForma] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const valorPago = parseValorBR(valorTexto)
    if (!pagoEm) return setError('Informe a data do pagamento.')
    if (valorPago == null || valorPago <= 0) return setError('Informe o valor pago (ex.: 1.234,56).')
    setError(null)
    setSubmitting(true)
    try {
      await registrarPagamento(conta.id, { pagoEm, valorPago, formaPagamento: forma || null })
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar o pagamento.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>Registrar pagamento</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <form className="modal-body" onSubmit={handleSubmit}>
          <p>
            <strong>{conta.descricao}</strong> · {formatBRL(conta.valor)}
          </p>
          <div className="field-row">
            <div className="field">
              <label>Data do pagamento *</label>
              <input type="date" value={pagoEm} onChange={(e) => setPagoEm(e.target.value)} required />
            </div>
            <div className="field">
              <label>Valor pago (R$) *</label>
              <input inputMode="decimal" value={valorTexto} onChange={(e) => setValorTexto(e.target.value)} required />
            </div>
          </div>
          <div className="field">
            <label>Forma de pagamento</label>
            <select value={forma} onChange={(e) => setForma(e.target.value)}>
              <option value="">Selecione...</option>
              {FORMAS_PAGAMENTO.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="login-error">{error}</p>}
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Salvando...' : 'Confirmar pagamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
