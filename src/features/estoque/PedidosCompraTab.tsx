import { useMemo, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isFullAdmin, useAuthStore } from '../../store/authStore'
import { confirmar } from '../../store/confirmStore'
import { isoDate } from '../../lib/date'
import { ESTOQUE_CATEGORIAS } from './estoqueConstants'
import { ordenarPorTitulo } from './estoqueHelpers'
import { useEstoqueItens } from './useEstoque'
import {
  PEDIDOS_COMPRA_KEY,
  criarPedidoCompra,
  espelhoUrl,
  excluirPedidoCompra,
  uploadEspelho,
  usePedidoCompraItens,
  usePedidosCompra,
  type NovoPedidoItem,
} from './usePedidosCompra'
import type { EstoqueCategoria, EstoqueItemRow, PedidoCompraRow } from '../../types/database'

interface LinhaForm {
  id: string
  setor: EstoqueCategoria
  produtoTexto: string
  quantidade: string
}

function novaLinha(setor: EstoqueCategoria): LinhaForm {
  return { id: crypto.randomUUID(), setor, produtoTexto: '', quantidade: '' }
}

export function PedidosCompraTab() {
  const profile = useAuthStore((s) => s.profile)
  const admin = isFullAdmin(profile)
  const queryClient = useQueryClient()
  const { data: itens } = useEstoqueItens()
  const { data: pedidos, isLoading } = usePedidosCompra()

  const [fornecedor, setFornecedor] = useState('')
  const [dataEntrega, setDataEntrega] = useState(isoDate(new Date()))
  const [horaEntrega, setHoraEntrega] = useState('')
  const [espelhoFile, setEspelhoFile] = useState<File | null>(null)
  const [observacoes, setObservacoes] = useState('')
  const [linhas, setLinhas] = useState<LinhaForm[]>([novaLinha('Bar')])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const itensPorSetor = useMemo(() => {
    const map = new Map<EstoqueCategoria, EstoqueItemRow[]>()
    ESTOQUE_CATEGORIAS.forEach((s) => map.set(s, ordenarPorTitulo((itens ?? []).filter((it) => it.categoria === s))))
    return map
  }, [itens])

  function resolverItem(linha: LinhaForm) {
    return (itensPorSetor.get(linha.setor) ?? []).find(
      (it) => it.title.toLowerCase() === linha.produtoTexto.trim().toLowerCase(),
    )
  }

  const linhasValidas: NovoPedidoItem[] = linhas
    .map((l) => {
      const item = resolverItem(l)
      const qtd = Number(l.quantidade)
      if (!item || !(qtd > 0)) return null
      return { estoqueItemId: item.id, produto: item.title, categoria: item.categoria, unidade: item.unidade, quantidade: qtd }
    })
    .filter((x): x is NovoPedidoItem => x !== null)

  const isValid = !!fornecedor.trim() && !!dataEntrega && linhasValidas.length > 0 && linhasValidas.length === linhas.length

  function setLinha(id: string, patch: Partial<LinhaForm>) {
    setLinhas((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isValid) return
    setError(null)
    setSuccess(null)
    setSubmitting(true)
    try {
      let espelhoPath: string | null = null
      if (espelhoFile) espelhoPath = await uploadEspelho(espelhoFile)
      await criarPedidoCompra({
        fornecedor,
        dataEntrega,
        horaEntrega: horaEntrega || null,
        espelhoUrl: espelhoPath,
        observacoes: observacoes.trim() || null,
        itens: linhasValidas,
      })
      await queryClient.invalidateQueries({ queryKey: PEDIDOS_COMPRA_KEY })
      setSuccess(`Pedido para "${fornecedor.trim()}" registrado.`)
      setFornecedor('')
      setHoraEntrega('')
      setEspelhoFile(null)
      setObservacoes('')
      setLinhas([novaLinha('Bar')])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar pedido.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!admin) return <div className="empty-state">Só o Administrador registra pedidos de compra.</div>

  return (
    <div>
      <h3 className="page-title" style={{ marginBottom: 16 }}>
        Pedidos de Compra
      </h3>

      <form className="modal-body" onSubmit={handleSubmit} style={{ maxWidth: 640, marginBottom: 32 }}>
        <div className="field-row">
          <div className="field" style={{ flex: 2 }}>
            <label>Fornecedor *</label>
            <input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} required />
          </div>
          <div className="field">
            <label>Data de entrega *</label>
            <input type="date" value={dataEntrega} onChange={(e) => setDataEntrega(e.target.value)} required />
          </div>
          <div className="field">
            <label>Hora de entrega</label>
            <input type="time" value={horaEntrega} onChange={(e) => setHoraEntrega(e.target.value)} />
          </div>
        </div>

        <label className="section-label" style={{ marginTop: 8 }}>
          Itens
        </label>
        {linhas.map((linha) => {
          const opcoes = itensPorSetor.get(linha.setor) ?? []
          const item = resolverItem(linha)
          return (
            <div className="field-row" key={linha.id} style={{ alignItems: 'flex-end' }}>
              <div className="field" style={{ maxWidth: 150 }}>
                <label>Setor</label>
                <select
                  value={linha.setor}
                  onChange={(e) => setLinha(linha.id, { setor: e.target.value as EstoqueCategoria, produtoTexto: '' })}
                >
                  {ESTOQUE_CATEGORIAS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ flex: 2 }}>
                <label>Produto</label>
                <input
                  value={linha.produtoTexto}
                  onChange={(e) => setLinha(linha.id, { produtoTexto: e.target.value })}
                  list={`pedido-prod-${linha.id}`}
                  placeholder="Digite pra buscar..."
                />
                <datalist id={`pedido-prod-${linha.id}`}>
                  {opcoes.map((it) => (
                    <option key={it.id} value={it.title} />
                  ))}
                </datalist>
                {linha.produtoTexto.trim() && !item && (
                  <span className="field-hint">Nenhum produto cadastrado com esse nome em {linha.setor}.</span>
                )}
              </div>
              <div className="field" style={{ maxWidth: 120 }}>
                <label>Qtd {item ? `(${item.unidade})` : ''}</label>
                <input
                  type="number"
                  min="0.001"
                  step="any"
                  value={linha.quantidade}
                  onChange={(e) => setLinha(linha.id, { quantidade: e.target.value })}
                />
              </div>
              <button
                type="button"
                className="icon-btn danger"
                title="Remover item"
                disabled={linhas.length === 1}
                onClick={() => setLinhas((prev) => prev.filter((l) => l.id !== linha.id))}
                style={{ marginBottom: 2 }}
              >
                ✕
              </button>
            </div>
          )
        })}
        <button
          type="button"
          className="btn btn-ghost"
          style={{ marginTop: 4 }}
          onClick={() => setLinhas((prev) => [...prev, novaLinha(prev[prev.length - 1]?.setor ?? 'Bar')])}
        >
          + Adicionar item
        </button>

        <div className="field" style={{ marginTop: 12 }}>
          <label>Espelho (imagem do pedido do fornecedor)</label>
          <input type="file" accept="image/*" onChange={(e) => setEspelhoFile(e.target.files?.[0] ?? null)} />
        </div>

        <div className="field">
          <label>Observações</label>
          <textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
        </div>

        {error && <p className="login-error">{error}</p>}
        {success && <p className="form-success">{success}</p>}
        <button type="submit" className="btn btn-primary" disabled={!isValid || submitting}>
          {submitting ? 'Registrando...' : 'Registrar pedido'}
        </button>
      </form>

      <h4 className="section-label">Pedidos registrados</h4>
      {isLoading && <div className="empty-state">Carregando…</div>}
      <div className="manage-list">
        {(pedidos ?? []).length === 0 && <div className="empty-state">Nenhum pedido registrado ainda.</div>}
        {(pedidos ?? []).map((p) => (
          <PedidoRow key={p.id} pedido={p} onExcluido={() => queryClient.invalidateQueries({ queryKey: PEDIDOS_COMPRA_KEY })} />
        ))}
      </div>
    </div>
  )
}

function PedidoRow({ pedido, onExcluido }: { pedido: PedidoCompraRow; onExcluido: () => void }) {
  const [aberto, setAberto] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const { data: itens } = usePedidoCompraItens(aberto ? pedido.id : undefined)

  async function verEspelho() {
    if (!pedido.espelho_url) return
    const url = await espelhoUrl(pedido.espelho_url)
    window.open(url, '_blank', 'noreferrer')
  }

  async function handleExcluir() {
    if (!(await confirmar(`Excluir o pedido para "${pedido.fornecedor}"? Esta ação não pode ser desfeita.`))) return
    setExcluindo(true)
    try {
      await excluirPedidoCompra(pedido.id)
      onExcluido()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Erro ao excluir pedido.')
    } finally {
      setExcluindo(false)
    }
  }

  return (
    <div className="manage-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div className="manage-row-info" style={{ cursor: 'pointer' }} onClick={() => setAberto((v) => !v)}>
          <strong>{pedido.fornecedor}</strong>
          <span>
            Entrega {new Date(`${pedido.data_entrega}T00:00:00`).toLocaleDateString('pt-BR')}
            {pedido.hora_entrega ? ` às ${pedido.hora_entrega.slice(0, 5)}` : ''}
          </span>
          <div className="account-badges">
            <span className={`badge-status ${pedido.status === 'recebido' ? 'badge-status-ativa' : 'badge-status-pendente'}`}>
              {pedido.status === 'recebido' ? 'Recebido' : 'Aguardando recebimento'}
            </span>
          </div>
        </div>
        <div className="manage-row-actions">
          {pedido.espelho_url && (
            <button className="icon-btn" title="Ver espelho" onClick={verEspelho}>
              🖼
            </button>
          )}
          {pedido.status === 'aberto' && (
            <button className="icon-btn danger" title="Excluir" disabled={excluindo} onClick={handleExcluir}>
              🗑
            </button>
          )}
        </div>
      </div>
      {aberto && (
        <div className="manage-list" style={{ marginTop: 4 }}>
          {(itens ?? []).map((it) => (
            <div className="manage-row" key={it.id}>
              <div className="manage-row-info">
                <strong>
                  {it.produto} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· {it.categoria}</span>
                </strong>
                <span>
                  Pedido: {it.quantidade} {it.unidade}
                  {it.recebido
                    ? ` · Recebido: ${it.quantidade_recebida ?? it.quantidade} ${it.unidade}`
                    : pedido.status === 'recebido'
                      ? ' · não recebido'
                      : ''}
                  {it.observacao ? ` · ${it.observacao}` : ''}
                </span>
              </div>
            </div>
          ))}
          {pedido.observacoes && <p className="field-hint">Obs.: {pedido.observacoes}</p>}
        </div>
      )}
    </div>
  )
}
