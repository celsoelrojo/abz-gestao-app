import { useState, type FormEvent } from 'react'
import { isoDate } from '../../lib/date'
import { CONTA_CATEGORIAS } from './financeiroConstants'
import { contaFormError, formatBRL, parseValorBR } from './contaHelpers'
import { atualizarConta, criarContas } from './useContasPagar'
import type { ContaPagarRow } from '../../types/database'

export function ContaFormModal({
  conta,
  onClose,
  onSaved,
}: {
  conta: ContaPagarRow | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [descricao, setDescricao] = useState(conta?.descricao ?? '')
  const [fornecedor, setFornecedor] = useState(conta?.fornecedor ?? '')
  const [categoria, setCategoria] = useState(conta?.categoria ?? 'Outros')
  const [valorTexto, setValorTexto] = useState(conta ? conta.valor.toFixed(2).replace('.', ',') : '')
  const [vencimento, setVencimento] = useState(conta?.vencimento ?? isoDate(new Date()))
  const [repete, setRepete] = useState(false)
  const [repeticoes, setRepeticoes] = useState('12')
  const [observacoes, setObservacoes] = useState(conta?.observacoes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const valor = parseValorBR(valorTexto)
  const repeticoesNum = repete ? Number(repeticoes) : 1
  // Categoria antiga que saiu da lista continua selecionável ao editar.
  const categorias = CONTA_CATEGORIAS.includes(categoria) ? CONTA_CATEGORIAS : [categoria, ...CONTA_CATEGORIAS]

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const validationError = contaFormError({ descricao, valor, vencimento, repeticoes: repeticoesNum })
    if (validationError || valor == null) {
      setError(validationError)
      return
    }
    const input = {
      descricao: descricao.trim(),
      fornecedor: fornecedor.trim() || null,
      categoria,
      valor,
      vencimento,
      observacoes: observacoes.trim() || null,
    }
    setSubmitting(true)
    try {
      if (conta) await atualizarConta(conta.id, input)
      else await criarContas(input, repeticoesNum)
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar a conta.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal modal-wide">
        <div className="modal-header">
          <h3>{conta ? 'Editar conta' : 'Nova conta a pagar'}</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="field">
            <label>Descrição *</label>
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Conta de energia, Fornecedor de cerveja"
              maxLength={120}
              required
            />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Fornecedor / credor</label>
              <input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} />
            </div>
            <div className="field">
              <label>Categoria *</label>
              <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Valor (R$) *</label>
              <input
                inputMode="decimal"
                value={valorTexto}
                onChange={(e) => setValorTexto(e.target.value)}
                placeholder="1.234,56"
                required
              />
              {valor != null && valor > 0 && <span className="field-hint">{formatBRL(valor)}</span>}
            </div>
            <div className="field">
              <label>{repete && !conta ? 'Primeiro vencimento *' : 'Vencimento *'}</label>
              <input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} required />
            </div>
          </div>

          {!conta && (
            <div className="field">
              <label>Repetição</label>
              <div className="sector-filter">
                <button type="button" className={`sector-filter-btn ${!repete ? 'active' : ''}`} onClick={() => setRepete(false)}>
                  Só uma vez
                </button>
                <button type="button" className={`sector-filter-btn ${repete ? 'active' : ''}`} onClick={() => setRepete(true)}>
                  Todo mês
                </button>
              </div>
              {repete && (
                <>
                  <input
                    type="number"
                    min="2"
                    max="60"
                    value={repeticoes}
                    onChange={(e) => setRepeticoes(e.target.value)}
                    style={{ marginTop: 8, maxWidth: 140 }}
                  />
                  <span className="field-hint">
                    Cria uma conta para cada um dos próximos {repeticoesNum || 0} meses, no mesmo dia. Cada uma pode ser
                    paga e editada separadamente.
                  </span>
                </>
              )}
            </div>
          )}

          <div className="field">
            <label>Observações</label>
            <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
          </div>

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
