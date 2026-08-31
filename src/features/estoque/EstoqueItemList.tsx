import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { formatDateBR, isoDate } from '../../lib/date'
import {
  agruparPorCampo,
  estoqueItemCritico,
  estoqueQuantidadeLabel,
  formatValidadeRotulo,
  ordenarPorTitulo,
  validadeInfo,
  validadeProxima,
} from './estoqueHelpers'
import { ESTOQUE_ITENS_KEY, ESTOQUE_MOVIMENTOS_KEY, ajustarQuantidadeEstoque } from './useEstoque'
import type { EstoqueItemRow } from '../../types/database'

const todayIso = isoDate(new Date())

// Lista de leitura do saldo, sempre Setor > Categoria > Subcategoria (nessa
// ordem) — reaproveitada tanto pela aba "Estoque" quanto pelo painel de
// referência da aba "Retirada". `showSetor` controla só se o primeiro nível
// (Setor) é renderizado — quando a tela já está travada num único setor, não
// faz sentido repetir esse nível. `podeAjustar` (pedido do usuário: admin
// ajustar quantidade direto) só é passado true pela aba "Estoque" — no
// painel de referência da Retirada não faz sentido oferecer o botão no meio
// do fluxo de registrar uma saída.
export function EstoqueItemList({
  itens,
  showSetor,
  search,
  podeAjustar = false,
}: {
  itens: EstoqueItemRow[]
  showSetor: boolean
  search?: string
  podeAjustar?: boolean
}) {
  const queryClient = useQueryClient()
  const [ajustando, setAjustando] = useState<EstoqueItemRow | null>(null)

  const termo = search?.trim().toLowerCase()
  const filtrados = termo ? itens.filter((it) => it.title.toLowerCase().includes(termo)) : itens

  async function refetch() {
    await queryClient.invalidateQueries({ queryKey: ESTOQUE_ITENS_KEY })
    await queryClient.invalidateQueries({ queryKey: ESTOQUE_MOVIMENTOS_KEY })
  }

  return (
    <>
      {filtrados.length === 0 && <div className="empty-state">Nenhum produto encontrado.</div>}
      {filtrados.length > 0 &&
        (showSetor ? (
          agruparPorCampo(filtrados, (it) => it.categoria, '—').map((grupoSetor) => (
            <div key={grupoSetor.chave} style={{ marginBottom: 24 }}>
              <h3 className="section-label">{grupoSetor.chave}</h3>
              <CategoriaSubcategoriaGrupos itens={grupoSetor.itens} podeAjustar={podeAjustar} onAjustar={setAjustando} />
            </div>
          ))
        ) : (
          <CategoriaSubcategoriaGrupos itens={filtrados} podeAjustar={podeAjustar} onAjustar={setAjustando} />
        ))}

      {ajustando && (
        <AjustarQuantidadeModal
          item={ajustando}
          onClose={() => setAjustando(null)}
          onSaved={async () => {
            setAjustando(null)
            await refetch()
          }}
        />
      )}
    </>
  )
}

function CategoriaSubcategoriaGrupos({
  itens,
  podeAjustar,
  onAjustar,
}: {
  itens: EstoqueItemRow[]
  podeAjustar: boolean
  onAjustar: (item: EstoqueItemRow) => void
}) {
  const porCategoria = agruparPorCampo(itens, (it) => it.produto_categoria, 'Sem categoria')
  return (
    <>
      {porCategoria.map((grupoCategoria) => {
        const porSubcategoria = agruparPorCampo(grupoCategoria.itens, (it) => it.subcategoria, 'Sem subcategoria')
        return (
          <div key={grupoCategoria.chave} style={{ marginBottom: 20 }}>
            <h4 className="section-label">{grupoCategoria.chave}</h4>
            {porSubcategoria.map((grupoSub) => (
              <div key={grupoSub.chave} style={{ marginBottom: 10 }}>
                {porSubcategoria.length > 1 && (
                  <div className="task-meta" style={{ marginBottom: 6 }}>
                    {grupoSub.chave}
                  </div>
                )}
                <div className="manage-list">
                  {ordenarPorTitulo(grupoSub.itens).map((item) => (
                    <EstoqueItemRowView key={item.id} item={item} podeAjustar={podeAjustar} onAjustar={onAjustar} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </>
  )
}

function EstoqueItemRowView({
  item,
  podeAjustar,
  onAjustar,
}: {
  item: EstoqueItemRow
  podeAjustar: boolean
  onAjustar: (item: EstoqueItemRow) => void
}) {
  const critico = estoqueItemCritico(item)
  const proximaValidade = validadeProxima(item, todayIso)
  const rotulo = item.validade ? formatValidadeRotulo(validadeInfo(item.validade, todayIso)) : null

  return (
    <div className={`manage-row ${critico ? 'content-row-critico' : ''}`}>
      <div className="manage-row-info">
        <strong>{item.title}</strong>
        <span>
          {estoqueQuantidadeLabel(item.quantidade, item.unidade)} em estoque · {item.categoria}
          {item.validade ? ` · Validade: ${formatDateBR(item.validade)}` : ''}
        </span>
        <div className="account-badges">
          {critico && <span className="badge-critico">Crítico</span>}
          {proximaValidade && (
            <span className={`badge-status ${rotulo === 'vencido' ? 'badge-status-bloqueada' : 'badge-status-pendente'}`}>
              {rotulo}
            </span>
          )}
        </div>
      </div>
      {podeAjustar && (
        <div className="manage-row-actions">
          <button className="icon-btn" title="Ajustar quantidade" onClick={() => onAjustar(item)}>
            ⚖
          </button>
        </div>
      )}
    </div>
  )
}

// Pedido do usuário: Administrador poder ajustar a quantidade de um item
// direto (contagem física, corrigir erro de lançamento) sem passar por
// Entrada/Retirada — grava no mesmo histórico de estoque_movimentos
// (tipo 'Ajuste de Estoque', migration 0033) em vez de um UPDATE silencioso.
function AjustarQuantidadeModal({
  item,
  onClose,
  onSaved,
}: {
  item: EstoqueItemRow
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [novaQuantidade, setNovaQuantidade] = useState(String(item.quantidade))
  const [observacao, setObservacao] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const novaNum = Number(novaQuantidade)
  const diferenca = novaNum - item.quantidade
  const isValid = novaQuantidade.trim() !== '' && novaNum >= 0 && diferenca !== 0

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isValid) return
    setError(null)
    setSubmitting(true)
    try {
      await ajustarQuantidadeEstoque(item.id, novaNum, observacao.trim() || null)
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao ajustar quantidade.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>Ajustar quantidade — {item.title}</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <form className="modal-body" onSubmit={handleSubmit}>
          <p className="field-hint">Saldo atual: {estoqueQuantidadeLabel(item.quantidade, item.unidade)}</p>
          <div className="field">
            <label>Nova quantidade * ({item.unidade})</label>
            <input
              type="number"
              min="0"
              step="any"
              autoFocus
              value={novaQuantidade}
              onChange={(e) => setNovaQuantidade(e.target.value)}
              required
            />
            {novaQuantidade.trim() !== '' && !isNaN(diferenca) && diferenca !== 0 && (
              <span className="field-hint">
                {diferenca > 0 ? `+${diferenca}` : diferenca} {item.unidade} em relação ao saldo atual
              </span>
            )}
          </div>
          <div className="field">
            <label>Motivo do ajuste</label>
            <textarea
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="ex.: contagem física, correção de erro de lançamento"
            />
          </div>
          {error && <p className="login-error">{error}</p>}
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={!isValid || submitting}>
              {submitting ? 'Salvando...' : 'Salvar ajuste'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
