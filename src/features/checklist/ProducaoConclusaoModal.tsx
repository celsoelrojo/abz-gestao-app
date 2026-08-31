import { useMemo, useState, type FormEvent } from 'react'
import { calcularProducaoEscalada } from '../fichas/fichaHelpers'
import type { EstoqueItemRow, FichaProducaoRow } from '../../types/database'

export interface IngredienteUsado {
  estoqueItemId: string
  quantidade: number
}

// Fluxo de conclusão de tarefa "envolve produção" — pedido do usuário: 1)
// perguntar o rendimento produzido, 2) mostrar os itens usados já calculados
// pela mesma escala da Calculadora de Produção (ver
// fichas/ProducaoCalculadora.tsx e fichaHelpers.calcularProducaoEscalada),
// deixando o operador ajustar antes de confirmar — o valor final de cada
// ingrediente é o que registrar_producao_checklist baixa do Estoque
// (migration 0032), ao mesmo tempo que dá entrada no produto remanufaturado.
export function ProducaoConclusaoModal({
  ficha,
  estoqueItens,
  onCancel,
  onConfirm,
}: {
  ficha: FichaProducaoRow
  estoqueItens: EstoqueItemRow[]
  onCancel: () => void
  onConfirm: (rendimento: number, ingredientes: IngredienteUsado[]) => void
}) {
  const itemPorId = useMemo(() => new Map(estoqueItens.map((it) => [it.id, it])), [estoqueItens])

  const [step, setStep] = useState<'rendimento' | 'itens'>('rendimento')
  const [rendimento, setRendimento] = useState('')
  const [quantidades, setQuantidades] = useState<Record<string, string>>({})

  const rendimentoNum = Number(rendimento)
  const rendimentoValido = rendimentoNum > 0

  function handleAvancar(e: FormEvent) {
    e.preventDefault()
    if (!rendimentoValido) return
    const escalado = ficha.qtd_lote_padrao
      ? calcularProducaoEscalada(ficha.ingredientes, ficha.qtd_lote_padrao, rendimentoNum)
      : null
    setQuantidades(
      Object.fromEntries(
        ficha.ingredientes.map((ing) => {
          const qtd = escalado?.quantidades[ing.id] ?? ing.quantidade ?? 0
          return [ing.id, qtd > 0 ? String(Math.round(qtd * 1000) / 1000) : '']
        }),
      ),
    )
    setStep('itens')
  }

  function handleConfirmar(e: FormEvent) {
    e.preventDefault()
    const ingredientes: IngredienteUsado[] = ficha.ingredientes
      .map((ing) => ({ estoqueItemId: ing.estoqueItemId, quantidade: Number(quantidades[ing.id]) || 0 }))
      .filter((i) => i.quantidade > 0)
    onConfirm(rendimentoNum, ingredientes)
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>Registrar produção — {ficha.nome}</h3>
          <button className="modal-close" onClick={onCancel}>
            ✕
          </button>
        </div>

        {step === 'rendimento' && (
          <form className="modal-body" onSubmit={handleAvancar}>
            <p>Concluir esta tarefa gera um lote, dá entrada no produto e baixa os ingredientes usados no Estoque.</p>
            <div className="field">
              <label>Rendimento produzido * {ficha.unidade_rendimento ? `(${ficha.unidade_rendimento})` : ''}</label>
              <input
                type="number"
                min="0.001"
                step="any"
                autoFocus
                value={rendimento}
                onChange={(e) => setRendimento(e.target.value)}
                placeholder={ficha.qtd_lote_padrao ? String(ficha.qtd_lote_padrao) : undefined}
                required
              />
              {!ficha.qtd_lote_padrao && (
                <span className="field-hint">
                  Ficha sem Rendimento configurado — os ingredientes serão sugeridos com a quantidade original da receita.
                </span>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={onCancel}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={!rendimentoValido}>
                Avançar
              </button>
            </div>
          </form>
        )}

        {step === 'itens' && (
          <form className="modal-body" onSubmit={handleConfirmar}>
            <p className="field-hint" style={{ marginBottom: 12 }}>
              Itens que serão baixados do Estoque para produzir {rendimento} {ficha.unidade_rendimento ?? ''}. Ajuste se necessário.
            </p>
            <div className="manage-list">
              {ficha.ingredientes.map((ing) => {
                const item = itemPorId.get(ing.estoqueItemId)
                return (
                  <div className="manage-row" key={ing.id}>
                    <div className="manage-row-info">
                      <strong>{item?.title ?? '(produto não encontrado)'}</strong>
                      {item?.unidade && <span>{item.unidade}</span>}
                    </div>
                    <div className="manage-row-actions">
                      <input
                        type="number"
                        step="any"
                        min={0}
                        style={{ width: 100 }}
                        value={quantidades[ing.id] ?? ''}
                        onChange={(e) => setQuantidades((prev) => ({ ...prev, [ing.id]: e.target.value }))}
                      />
                    </div>
                  </div>
                )
              })}
              {ficha.ingredientes.length === 0 && (
                <div className="empty-state">Esta ficha não tem ingredientes cadastrados.</div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setStep('rendimento')}>
                Voltar
              </button>
              <button type="submit" className="btn btn-primary">
                Confirmar produção
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
