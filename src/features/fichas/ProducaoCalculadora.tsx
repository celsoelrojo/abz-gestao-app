import { useMemo, useState } from 'react'
import { calcularProducaoEscalada } from './fichaHelpers'
import type { ProducaoIngrediente } from '../../types/database'

// Ferramenta só de leitura/preview — nunca grava na ficha salva (espelha
// updateProducaoCalculator do protótipo). Só funciona se houver um
// ingrediente marcado como "Base".
export function ProducaoCalculadora({
  ingredientes,
  qtdPorcoesUnidades,
}: {
  ingredientes: ProducaoIngrediente[]
  qtdPorcoesUnidades: number | null
}) {
  const base = useMemo(() => ingredientes.find((i) => i.tipo === 'base'), [ingredientes])
  const [quantidade, setQuantidade] = useState('')

  const resultado = useMemo(() => {
    const qtd = Number(quantidade)
    if (!base || !(qtd > 0)) return null
    return calcularProducaoEscalada(ingredientes, base.id, qtd, qtdPorcoesUnidades)
  }, [ingredientes, base, quantidade, qtdPorcoesUnidades])

  if (!base) {
    return <p className="field-hint">Marque um ingrediente como "Base" na ficha para habilitar a calculadora de produção.</p>
  }

  return (
    <div>
      <div className="field-row">
        <div className="field">
          <label>
            Quantidade desejada de {base.nome || 'ingrediente base'} ({base.unidade})
          </label>
          <input type="number" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} placeholder={base.qtdLotePadrao?.toString() ?? ''} />
        </div>
      </div>
      {resultado && (
        <div className="manage-list">
          {ingredientes
            .filter((i) => i.id !== base.id)
            .map((i) => (
              <div className="manage-row" key={i.id}>
                <div className="manage-row-info">
                  <strong>{i.nome || '(sem nome)'}</strong>
                  <span>
                    {(resultado.quantidades[i.id] ?? 0).toFixed(3)} {i.unidade}
                  </span>
                </div>
              </div>
            ))}
          <div className="manage-row">
            <div className="manage-row-info">
              <strong>Rendimento ajustado</strong>
              <span>{resultado.rendimentoAjustado.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
