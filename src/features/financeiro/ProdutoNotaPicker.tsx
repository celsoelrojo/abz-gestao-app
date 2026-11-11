import { useMemo, useState } from 'react'
import { formatQuantidade } from './cmvHelpers'
import { ordenarProdutosParaNota } from './notaHelpers'
import type { EstoqueItemRow } from '../../types/database'

// Seletor de produto do estoque para uma linha da nota: busca por nome/marca e,
// sem busca, os mais parecidos com o texto da nota aparecem primeiro.
export function ProdutoNotaPicker({
  descricaoNota,
  produtos,
  selecionadoId,
  onEscolher,
  onClose,
}: {
  descricaoNota: string
  produtos: EstoqueItemRow[]
  selecionadoId: string | null
  onEscolher: (produto: EstoqueItemRow | null) => void
  onClose: () => void
}) {
  const [busca, setBusca] = useState('')
  const lista = useMemo(() => ordenarProdutosParaNota(descricaoNota, produtos, busca), [descricaoNota, produtos, busca])

  return (
    <div className="modal-overlay">
      <div className="modal modal-wide">
        <div className="modal-header">
          <h3>Vincular ao estoque</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p className="field-hint">
            Item da nota: <strong>{descricaoNota}</strong>
          </p>
          <input
            type="text"
            autoFocus
            placeholder="Buscar produto do estoque..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          {lista.length === 0 && <div className="empty-state">Nenhum produto encontrado com essa busca.</div>}
          <div className="manage-list" style={{ maxHeight: '45vh', overflowY: 'auto' }}>
            {lista.map((p) => (
              <button
                type="button"
                key={p.id}
                className={`manage-row ${p.id === selecionadoId ? 'drag-over' : ''}`}
                style={{ textAlign: 'left', cursor: 'pointer', width: '100%', color: 'inherit', font: 'inherit' }}
                onClick={() => onEscolher(p)}
              >
                <div className="manage-row-info">
                  <strong>
                    {p.title}
                    {p.marca ? ` · ${p.marca}` : ''}
                  </strong>
                  <span>
                    Saldo: {formatQuantidade(p.quantidade)} {p.unidade.toLowerCase()} · {p.categoria}
                  </span>
                </div>
                {p.id === selecionadoId && <span className="badge-status badge-status-ativa">Vinculado</span>}
              </button>
            ))}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            {selecionadoId && (
              <button type="button" className="btn btn-ghost" onClick={() => onEscolher(null)}>
                Desvincular
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
