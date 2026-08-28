import { useMemo, useState } from 'react'
import { calcularProducaoEscalada } from './fichaHelpers'
import type { EstoqueItemRow, ProducaoIngrediente } from '../../types/database'

// Ferramenta só de leitura/preview — nunca grava na ficha salva (espelha
// updateProducaoCalculator do protótipo). Escala pelo Rendimento declarado
// na ficha (qtd_lote_padrao/unidade_rendimento), não mais por um ingrediente
// "Base" (removido do formulário — ver fichaHelpers.calcularProducaoEscalada).
export function ProducaoCalculadora({
  ingredientes,
  estoqueItens,
  qtdLotePadrao,
  unidadeRendimento,
}: {
  ingredientes: ProducaoIngrediente[]
  estoqueItens: EstoqueItemRow[]
  qtdLotePadrao: number | null
  unidadeRendimento: string | null
}) {
  const [rendimentoDesejado, setRendimentoDesejado] = useState('')

  const itemPorId = useMemo(() => new Map(estoqueItens.map((it) => [it.id, it])), [estoqueItens])

  const resultado = useMemo(() => {
    const desejado = Number(rendimentoDesejado)
    if (!(desejado > 0)) return null
    return calcularProducaoEscalada(ingredientes, qtdLotePadrao, desejado)
  }, [ingredientes, qtdLotePadrao, rendimentoDesejado])

  if (!qtdLotePadrao) {
    return <p className="field-hint">Configure o Rendimento na ficha (Validade e Rendimento) para habilitar a calculadora.</p>
  }

  return (
    <div>
      <div className="field-row">
        <div className="field">
          <label>
            Rendimento desejado {unidadeRendimento ? `(${unidadeRendimento})` : ''}
          </label>
          <input
            type="number"
            value={rendimentoDesejado}
            onChange={(e) => setRendimentoDesejado(e.target.value)}
            placeholder={qtdLotePadrao.toString()}
          />
        </div>
      </div>
      {resultado && (
        <div className="manage-list">
          {ingredientes.map((ing) => {
            const item = itemPorId.get(ing.estoqueItemId)
            return (
              <div className="manage-row" key={ing.id}>
                <div className="manage-row-info">
                  <strong>{item?.title ?? '(produto não encontrado)'}</strong>
                  <span>
                    {(resultado.quantidades[ing.id] ?? 0).toFixed(3)} {item?.unidade ?? ''}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
