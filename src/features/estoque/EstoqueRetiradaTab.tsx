import { useMemo, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isFullAdmin, useAuthStore } from '../../store/authStore'
import { isoDate } from '../../lib/date'
import { supabase } from '../../lib/supabaseClient'
import { visibleCategorias } from './estoqueAccess'
import { MOTIVOS_RETIRADA } from './estoqueConstants'
import { agruparPorCampo, estoqueQuantidadeLabel, ordenarPorTitulo } from './estoqueHelpers'
import { ESTOQUE_ITENS_KEY, ESTOQUE_MOVIMENTOS_KEY, useEstoqueItens, useEstoqueMovimentos } from './useEstoque'
import { EstoqueItemList } from './EstoqueItemList'
import type { EstoqueCategoria, EstoqueMovimentoRow, MotivoRetirada } from '../../types/database'

export function EstoqueRetiradaTab() {
  const profile = useAuthStore((s) => s.profile)
  const queryClient = useQueryClient()
  const admin = isFullAdmin(profile)
  const setores = visibleCategorias(profile)
  const locked = admin ? null : (profile?.setor ?? null)

  const [setor, setSetor] = useState<EstoqueCategoria>(locked ?? setores[0] ?? 'Bar')
  const [busca, setBusca] = useState('')
  const [itemId, setItemId] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [motivo, setMotivo] = useState<MotivoRetirada>('Uso interno')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { data: itens } = useEstoqueItens()
  const { data: movimentos } = useEstoqueMovimentos()

  const itensDoSetor = useMemo(() => (itens ?? []).filter((it) => it.categoria === setor), [itens, setor])
  const itensFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return termo ? itensDoSetor.filter((it) => it.title.toLowerCase().includes(termo)) : itensDoSetor
  }, [itensDoSetor, busca])

  const produtoGrupos = useMemo(() => {
    const grupos = agruparPorCampo(itensFiltrados, (it) => it.produto_categoria, 'Sem categoria')
    return grupos.map((g) => ({ ...g, itens: ordenarPorTitulo(g.itens) }))
  }, [itensFiltrados])

  const item = itensDoSetor.find((it) => it.id === itemId)
  const quantidadeNum = Number(quantidade)
  const saldoPrevisto = (item?.quantidade ?? 0) - (quantidadeNum || 0)
  const excedeSaldo = !!item && saldoPrevisto < 0
  const isValid = !!item && quantidadeNum > 0 && !!motivo && !excedeSaldo

  const historico = useMemo(
    () => (movimentos ?? []).filter((m) => m.categoria === setor && m.tipo !== 'Entrada Manual' && m.tipo !== 'Entrada por Produção'),
    [movimentos, setor],
  )

  async function refetch() {
    await queryClient.invalidateQueries({ queryKey: ESTOQUE_ITENS_KEY })
    await queryClient.invalidateQueries({ queryKey: ESTOQUE_MOVIMENTOS_KEY })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isValid || !item) return
    setError(null)
    setSubmitting(true)
    try {
      if (quantidadeNum > item.quantidade) {
        setError('A quantidade retirada não pode ser maior que o saldo disponível.')
        return
      }
      const { error: rpcError } = await supabase.rpc('registrar_saida_estoque', {
        p_item_id: item.id,
        p_quantidade: quantidadeNum,
        p_motivo: motivo,
        p_data_hora: new Date().toISOString(),
      })
      if (rpcError) {
        setError(rpcError.message)
        return
      }
      await refetch()
      setItemId('')
      setQuantidade('')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEstornar(movimentoId: string) {
    const mov = historico.find((m) => m.id === movimentoId)
    if (!mov) return
    if (
      !window.confirm(
        `Estornar a retirada de "${mov.produto}" (${estoqueQuantidadeLabel(mov.quantidade, mov.unidade)})? A quantidade volta ao Estoque e o histórico da correção fica registrado.`,
      )
    )
      return
    const { error: rpcError } = await supabase.rpc('estornar_retirada_estoque', { p_movimento_id: movimentoId })
    if (rpcError) {
      window.alert(rpcError.message)
      return
    }
    await refetch()
  }

  return (
    <div>
      <h3 className="page-title" style={{ marginBottom: 16 }}>
        Retirada do Estoque
      </h3>

      <div className="field-row">
        {!locked && (
          <div className="field" style={{ maxWidth: 220 }}>
            <label>Setor</label>
            <select
              value={setor}
              onChange={(e) => {
                setSetor(e.target.value as EstoqueCategoria)
                setItemId('')
              }}
            >
              {setores.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field" style={{ flex: 1 }}>
          <label>Buscar produto</label>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome do produto..." />
        </div>
      </div>

      <form className="modal-body" onSubmit={handleSubmit} style={{ maxWidth: 520, marginBottom: 28 }}>
        <div className="field">
          <label>Produto *</label>
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} required>
            <option value="">Selecione...</option>
            {produtoGrupos.map((g) => (
              <optgroup label={g.chave} key={g.chave}>
                {g.itens.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.subcategoria ? `${it.title} (${it.subcategoria})` : it.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Quantidade retirada * {item ? `(${item.unidade})` : ''}</label>
          <input type="number" min="0.001" step="any" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} required />
          {item && quantidade && (
            <span className="field-hint" style={excedeSaldo ? { color: 'var(--danger)', fontWeight: 700 } : undefined}>
              {excedeSaldo
                ? 'Excede o saldo disponível.'
                : `Saldo atual: ${estoqueQuantidadeLabel(item.quantidade, item.unidade)} · Saldo previsto após a retirada: ${estoqueQuantidadeLabel(saldoPrevisto, item.unidade)}`}
            </span>
          )}
        </div>
        <div className="field">
          <label>Motivo da retirada *</label>
          <select value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoRetirada)}>
            {MOTIVOS_RETIRADA.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="login-error">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={!isValid || submitting}>
          {submitting ? 'Registrando...' : 'Registrar retirada'}
        </button>
      </form>

      <h4 className="section-label">Itens do setor</h4>
      <EstoqueItemList itens={itensDoSetor} showSetor={false} search={busca} />

      <RetiradaHistorico historico={historico} admin={admin} onEstornar={handleEstornar} />
    </div>
  )
}

function RetiradaHistorico({
  historico,
  admin,
  onEstornar,
}: {
  historico: EstoqueMovimentoRow[]
  admin: boolean
  onEstornar: (movimentoId: string) => void
}) {
  const [filtroProduto, setFiltroProduto] = useState('')
  const [filtroMotivo, setFiltroMotivo] = useState<MotivoRetirada | 'Todos'>('Todos')
  const [filtroInicio, setFiltroInicio] = useState('')
  const [filtroFim, setFiltroFim] = useState('')

  const filtrado = useMemo(() => {
    return historico
      .filter((m) => !filtroProduto.trim() || m.produto.toLowerCase().includes(filtroProduto.trim().toLowerCase()))
      .filter((m) => filtroMotivo === 'Todos' || m.motivo === filtroMotivo)
      .filter((m) => !filtroInicio || isoDate(new Date(m.data_hora)) >= filtroInicio)
      .filter((m) => !filtroFim || isoDate(new Date(m.data_hora)) <= filtroFim)
      .sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime())
  }, [historico, filtroProduto, filtroMotivo, filtroInicio, filtroFim])

  return (
    <div style={{ marginTop: 28 }}>
      <h4 className="section-label">Histórico de retiradas</h4>
      <div className="field-row" style={{ marginBottom: 16 }}>
        <div className="field">
          <label>Produto</label>
          <input value={filtroProduto} onChange={(e) => setFiltroProduto(e.target.value)} />
        </div>
        <div className="field">
          <label>Motivo</label>
          <select value={filtroMotivo} onChange={(e) => setFiltroMotivo(e.target.value as MotivoRetirada | 'Todos')}>
            <option value="Todos">Todos</option>
            {MOTIVOS_RETIRADA.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>De</label>
          <input type="date" value={filtroInicio} onChange={(e) => setFiltroInicio(e.target.value)} />
        </div>
        <div className="field">
          <label>Até</label>
          <input type="date" value={filtroFim} onChange={(e) => setFiltroFim(e.target.value)} />
        </div>
      </div>

      <div className="manage-list">
        {filtrado.length === 0 && <div className="empty-state">Nenhuma retirada encontrada.</div>}
        {filtrado.map((m) => (
          <div className="manage-row" key={m.id}>
            <div className="manage-row-info">
              <strong>{m.produto}</strong>
              <span>
                {estoqueQuantidadeLabel(m.quantidade, m.unidade)} · {m.motivo ?? '—'} · {m.responsavel_nome} ·{' '}
                {new Date(m.data_hora).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
              {m.observacao && <span>{m.observacao}</span>}
              <div className="account-badges">
                {m.tipo === 'Estorno de Retirada' && <span className="badge-status badge-status-pendente">Estorno</span>}
                {m.tipo !== 'Estorno de Retirada' && m.estornada && (
                  <span className="badge-status badge-status-bloqueada">Estornada</span>
                )}
              </div>
            </div>
            {admin && m.tipo === 'Saída de Estoque' && !m.estornada && (
              <div className="manage-row-actions">
                <button className="icon-btn danger" title="Estornar" onClick={() => onEstornar(m.id)}>
                  ↺
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
