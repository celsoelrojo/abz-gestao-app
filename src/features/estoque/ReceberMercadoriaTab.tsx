import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ESTOQUE_ITENS_KEY, ESTOQUE_MOVIMENTOS_KEY } from './useEstoque'
import {
  PEDIDOS_COMPRA_KEY,
  PEDIDO_COMPRA_ITENS_KEY,
  conferirItem,
  espelhoUrl,
  finalizarRecebimento,
  usePedidoCompraItens,
  usePedidosCompra,
} from './usePedidosCompra'
import type { PedidoCompraItemRow, PedidoCompraRow } from '../../types/database'

export function ReceberMercadoriaTab() {
  const { data: pedidos, isLoading } = usePedidosCompra()
  const [conferindo, setConferindo] = useState<PedidoCompraRow | null>(null)

  const abertos = useMemo(
    () =>
      (pedidos ?? [])
        .filter((p) => p.status === 'aberto')
        .sort((a, b) => a.data_entrega.localeCompare(b.data_entrega)),
    [pedidos],
  )

  if (conferindo) {
    return <ConferenciaView pedido={conferindo} onVoltar={() => setConferindo(null)} />
  }

  return (
    <div>
      <h3 className="page-title" style={{ marginBottom: 16 }}>
        Receber Mercadoria
      </h3>
      <p className="page-subtitle" style={{ marginBottom: 16 }}>
        Pedidos que ainda não foram recebidos. Clique para conferir item a item.
      </p>
      {isLoading && <div className="empty-state">Carregando…</div>}
      <div className="manage-list">
        {abertos.length === 0 && <div className="empty-state">Nenhum pedido aguardando recebimento.</div>}
        {abertos.map((p) => (
          <button
            key={p.id}
            type="button"
            className="manage-row"
            style={{ width: '100%', textAlign: 'left', cursor: 'pointer', font: 'inherit' }}
            onClick={() => setConferindo(p)}
          >
            <div className="manage-row-info">
              <strong>{p.fornecedor}</strong>
              <span>
                Entrega {new Date(`${p.data_entrega}T00:00:00`).toLocaleDateString('pt-BR')}
                {p.hora_entrega ? ` às ${p.hora_entrega.slice(0, 5)}` : ''}
              </span>
            </div>
            <div className="manage-row-actions">
              <span className="badge-status badge-status-pendente">Conferir →</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function ConferenciaView({ pedido, onVoltar }: { pedido: PedidoCompraRow; onVoltar: () => void }) {
  const queryClient = useQueryClient()
  const { data: itens, isLoading } = usePedidoCompraItens(pedido.id)
  const [finalizando, setFinalizando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function verEspelho() {
    if (!pedido.espelho_url) return
    const url = await espelhoUrl(pedido.espelho_url)
    window.open(url, '_blank', 'noreferrer')
  }

  async function handleFinalizar() {
    setError(null)
    setFinalizando(true)
    try {
      await finalizarRecebimento(pedido.id)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: PEDIDOS_COMPRA_KEY }),
        queryClient.invalidateQueries({ queryKey: PEDIDO_COMPRA_ITENS_KEY(pedido.id) }),
        queryClient.invalidateQueries({ queryKey: ESTOQUE_ITENS_KEY }),
        queryClient.invalidateQueries({ queryKey: ESTOQUE_MOVIMENTOS_KEY }),
      ])
      onVoltar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao finalizar recebimento.')
    } finally {
      setFinalizando(false)
    }
  }

  return (
    <div>
      <div className="checklist-header" style={{ marginBottom: 12 }}>
        <div>
          <h3 className="page-title" style={{ marginBottom: 4 }}>
            {pedido.fornecedor}
          </h3>
          <p className="page-subtitle">
            Entrega {new Date(`${pedido.data_entrega}T00:00:00`).toLocaleDateString('pt-BR')}
            {pedido.hora_entrega ? ` às ${pedido.hora_entrega.slice(0, 5)}` : ''}
          </p>
        </div>
        <button className="btn btn-ghost" onClick={onVoltar}>
          ← Pedidos
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {pedido.espelho_url && (
          <button className="btn btn-ghost" onClick={verEspelho}>
            🖼 Ver espelho
          </button>
        )}
      </div>
      {pedido.observacoes && <p className="field-hint" style={{ marginBottom: 12 }}>Obs. do pedido: {pedido.observacoes}</p>}

      {isLoading && <div className="empty-state">Carregando…</div>}
      <div className="manage-list">
        {(itens ?? []).map((it) => (
          <ItemConferencia key={it.id} item={it} />
        ))}
      </div>

      {error && <p className="login-error" style={{ marginTop: 12 }}>{error}</p>}
      <div className="modal-footer" style={{ paddingLeft: 0, paddingRight: 0 }}>
        <button className="btn btn-primary" disabled={finalizando} onClick={handleFinalizar}>
          {finalizando ? 'Finalizando...' : 'Finalizar recebimento'}
        </button>
      </div>
      <p className="field-hint">
        Ao finalizar, os itens marcados como recebidos entram no estoque e o pedido sai desta lista.
      </p>
    </div>
  )
}

function ItemConferencia({ item }: { item: PedidoCompraItemRow }) {
  const [recebido, setRecebido] = useState(item.recebido)
  const [quantidade, setQuantidade] = useState(
    item.quantidade_recebida != null ? String(item.quantidade_recebida) : String(item.quantidade),
  )
  const [observacao, setObservacao] = useState(item.observacao ?? '')
  const [erro, setErro] = useState(false)

  const qtdNum = Number(quantidade)
  const divergente = recebido && qtdNum > 0 && qtdNum !== item.quantidade

  async function salvar(patch: Parameters<typeof conferirItem>[1]) {
    try {
      setErro(false)
      await conferirItem(item.id, patch)
    } catch {
      setErro(true)
    }
  }

  return (
    <div className={`manage-row ${divergente ? 'content-row-critico' : ''}`} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          checked={recebido}
          onChange={(e) => {
            setRecebido(e.target.checked)
            void salvar({ recebido: e.target.checked })
          }}
        />
        <strong>{item.produto}</strong>
        <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
          · {item.categoria} · pedido: {item.quantidade} {item.unidade}
        </span>
      </label>

      {recebido && (
        <div className="field-row" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ maxWidth: 160 }}>
            <label>Quantidade recebida ({item.unidade})</label>
            <input
              type="number"
              min="0"
              step="any"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              onBlur={() => void salvar({ quantidade_recebida: quantidade === '' ? null : Number(quantidade) })}
            />
            {divergente && <span className="field-hint" style={{ color: 'var(--danger)' }}>Diferente do pedido ({item.quantidade}).</span>}
          </div>
          <div className="field" style={{ flex: 1, minWidth: 180 }}>
            <label>Observação (se veio fora do padrão)</label>
            <input value={observacao} onChange={(e) => setObservacao(e.target.value)} onBlur={() => void salvar({ observacao: observacao.trim() || null })} />
          </div>
        </div>
      )}
      {erro && <span className="field-hint" style={{ color: 'var(--danger)' }}>Não salvou — verifique a conexão.</span>}
    </div>
  )
}
