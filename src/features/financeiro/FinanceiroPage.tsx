import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Icon } from '../../components/Icon'
import { formatDateBR, isoDate } from '../../lib/date'
import { confirmar } from '../../store/confirmStore'
import { CONTA_CATEGORIAS } from './financeiroConstants'
import {
  CONTA_SITUACAO_BADGE_CLASS,
  CONTA_SITUACAO_LABELS,
  formatBRL,
  ordenarEmAberto,
  ordenarPagas,
  resumirContas,
  situacaoConta,
} from './contaHelpers'
import {
  CONTAS_PAGAR_KEY,
  desfazerPagamento,
  excluirConta,
  useContasPagar,
  useContasPagarRealtime,
} from './useContasPagar'
import { ContaFormModal } from './ContaFormModal'
import { PagarModal } from './PagarModal'
import { LerNotaModal } from './LerNotaModal'
import { NotaDetalheModal } from './NotaDetalheModal'
import type { ContaPagarRow } from '../../types/database'

// Financeiro, etapa 1: Contas a pagar. Exclusivo do Administrador (rota em
// App.tsx e RLS contas_pagar_admin_all). O CMV entra como a próxima aba.
export function FinanceiroPage() {
  const queryClient = useQueryClient()
  const { data: contas, isLoading } = useContasPagar()
  useContasPagarRealtime()

  const hoje = isoDate(new Date())
  const [aba, setAba] = useState<'abertas' | 'pagas'>('abertas')
  const [busca, setBusca] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('Todas')
  const [filtroMes, setFiltroMes] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<ContaPagarRow | null>(null)
  const [pagando, setPagando] = useState<ContaPagarRow | null>(null)
  const [lendoNota, setLendoNota] = useState(false)
  const [verNota, setVerNota] = useState<ContaPagarRow | null>(null)

  const resumo = useMemo(() => resumirContas(contas ?? [], hoje), [contas, hoje])

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return (contas ?? [])
      .filter((c) => filtroCategoria === 'Todas' || c.categoria === filtroCategoria)
      .filter((c) => !filtroMes || c.vencimento.startsWith(filtroMes))
      .filter(
        (c) =>
          !termo ||
          c.descricao.toLowerCase().includes(termo) ||
          (c.fornecedor ?? '').toLowerCase().includes(termo) ||
          c.categoria.toLowerCase().includes(termo),
      )
  }, [contas, busca, filtroCategoria, filtroMes])

  const abertas = useMemo(() => ordenarEmAberto(filtradas.filter((c) => !c.pago_em)), [filtradas])
  const pagas = useMemo(() => ordenarPagas(filtradas.filter((c) => !!c.pago_em)), [filtradas])
  const lista = aba === 'abertas' ? abertas : pagas
  const totalLista = lista.reduce((s, c) => s + (aba === 'pagas' ? (c.valor_pago ?? c.valor) : c.valor), 0)

  // Categorias que realmente existem + as padrão, pro filtro.
  const categoriasFiltro = useMemo(
    () => Array.from(new Set([...CONTA_CATEGORIAS, ...(contas ?? []).map((c) => c.categoria)])),
    [contas],
  )

  async function recarregar() {
    await queryClient.invalidateQueries({ queryKey: CONTAS_PAGAR_KEY })
  }

  async function desfazer(c: ContaPagarRow) {
    if (!(await confirmar(`Desfazer o pagamento de "${c.descricao}"? A conta volta para "em aberto".`))) return
    try {
      await desfazerPagamento(c.id)
      await recarregar()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Erro ao desfazer o pagamento.')
    }
  }

  async function excluir(c: ContaPagarRow) {
    if (!(await confirmar(`Excluir a conta "${c.descricao}" (${formatBRL(c.valor)})? Esta ação não pode ser desfeita.`))) return
    try {
      await excluirConta(c)
      await recarregar()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Erro ao excluir a conta.')
    }
  }

  if (isLoading) return <div className="empty-state">Carregando…</div>

  const hasFiltros = !!(busca.trim() || filtroMes || filtroCategoria !== 'Todas')

  return (
    <div className="container">
      <div className="checklist-header">
        <div>
          <h2 className="page-title">Financeiro</h2>
          <p className="page-subtitle">Contas a pagar</p>
        </div>
      </div>

      <div className="fin-resumo">
        <ResumoCard titulo="Em aberto" valor={resumo.emAberto.total} qtd={resumo.emAberto.quantidade} />
        <ResumoCard titulo="Vencidas" valor={resumo.vencidas.total} qtd={resumo.vencidas.quantidade} tom="perigo" />
        <ResumoCard titulo="Próximos 7 dias" valor={resumo.proximos7.total} qtd={resumo.proximos7.quantidade} tom="atencao" />
        <ResumoCard titulo="Pago neste mês" valor={resumo.pagoNoMes.total} qtd={resumo.pagoNoMes.quantidade} tom="ok" />
      </div>

      <div className="quick-actions">
        <button
          type="button"
          className={`quick-btn ${aba === 'abertas' ? 'quick-btn-active' : ''}`}
          onClick={() => setAba('abertas')}
        >
          <Icon name="financeiro-abertas" className="quick-icon" />
          <span className="quick-label">A pagar ({abertas.length})</span>
        </button>
        <button type="button" className="quick-btn" onClick={() => setCreating(true)}>
          <Icon name="financeiro-nova" className="quick-icon" />
          <span className="quick-label">Nova Conta</span>
        </button>
        <button type="button" className="quick-btn" onClick={() => setLendoNota(true)}>
          <Icon name="financeiro-nota" className="quick-icon" />
          <span className="quick-label">Ler Nota</span>
        </button>
        <button
          type="button"
          className={`quick-btn ${aba === 'pagas' ? 'quick-btn-active' : ''}`}
          onClick={() => setAba('pagas')}
        >
          <Icon name="financeiro-pagas" className="quick-icon" />
          <span className="quick-label">Pagas ({pagas.length})</span>
        </button>
      </div>

      <div className="reserva-filters">
        <input type="text" placeholder="Buscar conta ou fornecedor..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        <input type="month" value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} title="Mês do vencimento" />
        <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
          <option value="Todas">Todas as categorias</option>
          {categoriasFiltro.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {hasFiltros && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setBusca('')
              setFiltroMes('')
              setFiltroCategoria('Todas')
            }}
          >
            Limpar filtros
          </button>
        )}
      </div>

      <h3 className="section-label">
        {aba === 'abertas' ? 'A pagar' : 'Pagas'}
        {lista.length > 0 && ` · total ${formatBRL(totalLista)}`}
      </h3>

      {lista.length === 0 && (
        <div className="empty-state">{aba === 'abertas' ? 'Nenhuma conta a pagar.' : 'Nenhuma conta paga.'}</div>
      )}

      <div className="manage-list">
        {lista.map((c) => {
          const situacao = situacaoConta(c, hoje)
          return (
            <div className="manage-row" key={c.id} style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div className="manage-row-info">
                <strong>
                  {c.descricao}
                  {c.parcela && c.parcelas ? ` (${c.parcela}/${c.parcelas})` : ''}
                </strong>
                <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '4px 0' }}>
                  <span className={`badge-status ${CONTA_SITUACAO_BADGE_CLASS[situacao]}`}>{CONTA_SITUACAO_LABELS[situacao]}</span>
                  <span className="badge-status badge-status-pendente">{c.categoria}</span>
                </span>
                <span style={{ display: 'block' }}>
                  {formatBRL(c.valor)} · vence {formatDateBR(c.vencimento)}
                  {c.fornecedor ? ` · ${c.fornecedor}` : ''}
                </span>
                {c.pago_em && (
                  <span style={{ display: 'block' }}>
                    Pago em {formatDateBR(c.pago_em)}: {formatBRL(c.valor_pago ?? c.valor)}
                    {c.forma_pagamento ? ` (${c.forma_pagamento})` : ''}
                  </span>
                )}
                {c.observacoes && <span style={{ display: 'block', whiteSpace: 'pre-wrap' }}>{c.observacoes}</span>}
                {(c.nota_foto_path || c.itens_nota) && (
                  <button type="button" className="btn btn-ghost" style={{ marginTop: 6 }} onClick={() => setVerNota(c)}>
                    Ver nota
                  </button>
                )}
              </div>
              <div className="manage-row-actions" style={{ flexWrap: 'wrap' }}>
                {!c.pago_em && (
                  <button className="btn btn-primary" onClick={() => setPagando(c)}>
                    Marcar paga
                  </button>
                )}
                {c.pago_em && (
                  <button className="btn btn-ghost" onClick={() => desfazer(c)}>
                    Desfazer
                  </button>
                )}
                <button className="icon-btn" title="Editar" onClick={() => setEditing(c)}>
                  ✎
                </button>
                <button className="icon-btn danger" title="Excluir" onClick={() => excluir(c)}>
                  🗑
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {(creating || editing) && (
        <ContaFormModal
          conta={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={async () => {
            setCreating(false)
            setEditing(null)
            await recarregar()
          }}
        />
      )}

      {lendoNota && (
        <LerNotaModal
          contas={contas ?? []}
          onClose={() => setLendoNota(false)}
          onSaved={async () => {
            setLendoNota(false)
            await recarregar()
          }}
        />
      )}

      {verNota && <NotaDetalheModal conta={verNota} onClose={() => setVerNota(null)} />}

      {pagando && (
        <PagarModal
          conta={pagando}
          onClose={() => setPagando(null)}
          onSaved={async () => {
            setPagando(null)
            await recarregar()
          }}
        />
      )}
    </div>
  )
}

function ResumoCard({
  titulo,
  valor,
  qtd,
  tom,
}: {
  titulo: string
  valor: number
  qtd: number
  tom?: 'perigo' | 'atencao' | 'ok'
}) {
  const cor =
    tom === 'perigo' && qtd > 0
      ? 'var(--danger)'
      : tom === 'atencao' && qtd > 0
        ? 'var(--gold-bright)'
        : tom === 'ok'
          ? 'var(--success)'
          : 'var(--text-primary)'
  return (
    <div className="fin-resumo-card">
      <span className="fin-resumo-titulo">{titulo}</span>
      <strong className="fin-resumo-valor" style={{ color: cor }}>
        {formatBRL(valor)}
      </strong>
      <span className="fin-resumo-qtd">
        {qtd} {qtd === 1 ? 'conta' : 'contas'}
      </span>
    </div>
  )
}
