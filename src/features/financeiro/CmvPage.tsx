import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Icon } from '../../components/Icon'
import { formatDateBR, isoDate } from '../../lib/date'
import { useDiaOperacional } from '../../lib/useDiaOperacional'
import { useEstoqueItens } from '../estoque/useEstoque'
import {
  PERIODO_PRESET_LABELS,
  calcularCmv,
  dataDaCompra,
  formatCusto,
  formatPercent,
  formatQuantidade,
  periodoDoPreset,
  somarCompras,
  somarFaturamento,
  valorizarEstoque,
  type LinhaEstoque,
  type Periodo,
  type PeriodoPreset,
} from './cmvHelpers'
import { formatBRL } from './contaHelpers'
import { useContasPagar } from './useContasPagar'
import { FATURAMENTO_KEY, useEstoqueCustos, useFaturamento, useSaldosDoPeriodo } from './useCmv'
import { FinanceiroAbas } from './FinanceiroAbas'
import { FaturamentoModal } from './FaturamentoModal'
import { CustosEstoqueModal } from './CustosEstoqueModal'

const PRESETS = Object.keys(PERIODO_PRESET_LABELS) as PeriodoPreset[]

// Financeiro, parte 2: CMV. CMV = estoque inicial + compras − estoque final.
// Estoque inicial/final = saldo de cada produto na data (reconstruído do
// histórico de movimentos) × custo por unidade; compras = contas de categoria
// "Mercadoria" pela data da compra; faturamento = digitado dia a dia.
export function CmvPage() {
  const queryClient = useQueryClient()
  const hoje = isoDate(useDiaOperacional())
  const [preset, setPreset] = useState<PeriodoPreset | 'custom'>('mes')
  const [custom, setCustom] = useState<Periodo>(() => periodoDoPreset('semana', hoje))
  const [lancandoFaturamento, setLancandoFaturamento] = useState(false)
  const [editandoCustos, setEditandoCustos] = useState(false)

  const periodo = useMemo(() => (preset === 'custom' ? custom : periodoDoPreset(preset, hoje)), [preset, custom, hoje])
  const periodoValido = !!periodo.inicio && !!periodo.fim && periodo.inicio <= periodo.fim

  const itens = useEstoqueItens()
  const custos = useEstoqueCustos()
  const contas = useContasPagar()
  const faturamento = useFaturamento(periodo)
  const { inicial: saldoInicial, final: saldoFinal } = useSaldosDoPeriodo(periodo)

  const consultas = [itens, custos, contas, faturamento, saldoInicial, saldoFinal]
  const carregando = consultas.some((q) => q.isLoading)
  const erro = consultas.find((q) => q.isError)?.error

  const resultado = useMemo(() => {
    if (!periodoValido || !itens.data || !custos.data || !contas.data || !faturamento.data || !saldoInicial.data || !saldoFinal.data) {
      return null
    }
    const custoPorItem = new Map(custos.data.map((c) => [c.item_id, c.custo_unitario]))
    const inicial = valorizarEstoque(itens.data, saldoInicial.data, custoPorItem)
    const final = valorizarEstoque(itens.data, saldoFinal.data, custoPorItem)
    const compras = somarCompras(contas.data, periodo)
    const fat = somarFaturamento(faturamento.data, periodo, hoje)
    const cmv = calcularCmv({
      estoqueInicial: inicial.total,
      compras: compras.total,
      estoqueFinal: final.total,
      faturamento: fat.total,
    })
    // Mesmo produto sem custo no início e no fim conta uma vez só no aviso.
    const semCusto = new Map([...inicial.semCusto, ...final.semCusto].map((l) => [l.itemId, l]))
    return { inicial, final, compras, fat, cmv, semCusto: [...semCusto.values()] }
  }, [periodoValido, itens.data, custos.data, contas.data, faturamento.data, saldoInicial.data, saldoFinal.data, periodo, hoje])

  async function recarregarFaturamento() {
    await queryClient.invalidateQueries({ queryKey: FATURAMENTO_KEY })
    setLancandoFaturamento(false)
  }

  const emAndamento = periodo.fim >= hoje

  return (
    <div className="container">
      <div className="checklist-header">
        <div>
          <h2 className="page-title">Financeiro</h2>
          <p className="page-subtitle">CMV — custo da mercadoria vendida</p>
        </div>
      </div>

      <FinanceiroAbas />

      <div className="quick-actions">
        <button type="button" className="quick-btn" onClick={() => setLancandoFaturamento(true)}>
          <Icon name="financeiro-faturamento" className="quick-icon" />
          <span className="quick-label">Faturamento</span>
        </button>
        <button type="button" className="quick-btn" onClick={() => setEditandoCustos(true)}>
          <Icon name="financeiro-custos" className="quick-icon" />
          <span className="quick-label">Custos do Estoque</span>
        </button>
      </div>

      <div className="sector-filter" style={{ flexWrap: 'wrap', marginBottom: 8 }}>
        {PRESETS.map((p) => (
          <button key={p} type="button" className={`sector-filter-btn ${preset === p ? 'active' : ''}`} onClick={() => setPreset(p)}>
            {PERIODO_PRESET_LABELS[p]}
          </button>
        ))}
        <button type="button" className={`sector-filter-btn ${preset === 'custom' ? 'active' : ''}`} onClick={() => setPreset('custom')}>
          Outro período
        </button>
      </div>

      {preset === 'custom' ? (
        <div className="reserva-filters">
          <input type="date" value={custom.inicio} onChange={(e) => setCustom({ ...custom, inicio: e.target.value })} aria-label="Início do período" />
          <input type="date" value={custom.fim} onChange={(e) => setCustom({ ...custom, fim: e.target.value })} aria-label="Fim do período" />
        </div>
      ) : (
        <p className="field-hint">
          {formatDateBR(periodo.inicio)} a {formatDateBR(periodo.fim)}
        </p>
      )}

      {!periodoValido && <p className="login-error">A data final precisa ser igual ou depois da inicial.</p>}
      {erro && (
        <p className="login-error">
          Não foi possível calcular o CMV{erro instanceof Error ? `: ${erro.message}` : '.'}
        </p>
      )}
      {periodoValido && carregando && <div className="empty-state">Calculando…</div>}

      {resultado && !erro && (
        <>
          <div className="fin-resumo">
            <CmvCard titulo="Faturamento" valor={formatBRL(resultado.fat.total)} detalhe={`${resultado.fat.diasLancados} ${resultado.fat.diasLancados === 1 ? 'dia lançado' : 'dias lançados'}`} />
            <CmvCard titulo="CMV" valor={formatBRL(resultado.cmv.cmv)} detalhe="custo da mercadoria vendida" />
            <CmvCard
              titulo="CMV %"
              valor={resultado.cmv.percentual == null ? '—' : formatPercent(resultado.cmv.percentual)}
              detalhe={resultado.cmv.percentual == null ? 'lance o faturamento' : 'do faturamento'}
              destaque
            />
          </div>

          <h3 className="section-label">Como chegamos nesse número</h3>
          <div className="manage-list">
            <LinhaConta rotulo="Estoque inicial" apoio={`saldo em ${formatDateBR(periodo.inicio)} (5h)`} valor={formatBRL(resultado.inicial.total)} />
            <LinhaConta rotulo="+ Compras de mercadoria" apoio={`${resultado.compras.contas.length} ${resultado.compras.contas.length === 1 ? 'conta' : 'contas'}`} valor={formatBRL(resultado.compras.total)} />
            <LinhaConta rotulo="− Estoque final" apoio={emAndamento ? 'saldo de agora (período em andamento)' : `saldo em ${formatDateBR(periodo.fim)}`} valor={formatBRL(resultado.final.total)} />
            <LinhaConta rotulo="= CMV" valor={formatBRL(resultado.cmv.cmv)} forte />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '12px 0' }}>
            {resultado.fat.total === 0 && (
              <p className="field-hint" style={{ color: 'var(--gold-bright)' }}>
                Nenhum faturamento lançado neste período — lance o faturamento para ver o CMV em %.
              </p>
            )}
            {resultado.fat.total > 0 && resultado.fat.diasSemLancamento.length > 0 && (
              <p className="field-hint" style={{ color: 'var(--gold-bright)' }}>
                Faturamento não lançado em {resultado.fat.diasSemLancamento.length}{' '}
                {resultado.fat.diasSemLancamento.length === 1 ? 'dia' : 'dias'} (
                {resultado.fat.diasSemLancamento.slice(0, 6).map(formatDateBR).join(', ')}
                {resultado.fat.diasSemLancamento.length > 6 ? '…' : ''}). Sem eles o CMV % sai maior do que o real; se o bar
                estava fechado, lance 0.
              </p>
            )}
            {resultado.semCusto.length > 0 && (
              <p className="field-hint" style={{ color: 'var(--gold-bright)' }}>
                {resultado.semCusto.length} {resultado.semCusto.length === 1 ? 'produto com saldo está' : 'produtos com saldo estão'} sem custo e
                ficam fora do estoque ({resultado.semCusto.slice(0, 4).map((l) => l.titulo).join(', ')}
                {resultado.semCusto.length > 4 ? '…' : ''}).{' '}
                <button type="button" className="btn btn-ghost" onClick={() => setEditandoCustos(true)}>
                  Preencher custos
                </button>
              </p>
            )}
            {resultado.cmv.cmv < 0 && (
              <p className="field-hint" style={{ color: 'var(--danger)' }}>
                CMV negativo: o estoque final ficou maior que o inicial somado às compras. Confira as entradas de estoque e os
                custos dos produtos.
              </p>
            )}
            {emAndamento && (
              <p className="field-hint">Período em andamento: o estoque final é o saldo de agora e o CMV muda a cada compra, retirada e faturamento lançado.</p>
            )}
          </div>

          {resultado.compras.porCategoria.length > 0 && (
            <>
              <h3 className="section-label">Compras por categoria</h3>
              <div className="manage-list">
                {resultado.compras.porCategoria.map((c) => (
                  <LinhaConta key={c.categoria} rotulo={c.categoria} apoio={`${c.quantidade} ${c.quantidade === 1 ? 'conta' : 'contas'}`} valor={formatBRL(c.total)} />
                ))}
              </div>
              <details style={{ margin: '10px 0' }}>
                <summary>Ver as contas</summary>
                <div className="manage-list" style={{ marginTop: 8 }}>
                  {resultado.compras.contas.map((c) => (
                    <LinhaConta
                      key={c.id}
                      rotulo={c.descricao}
                      apoio={`comprado em ${formatDateBR(dataDaCompra(c))}${c.data_compra ? '' : ' (vencimento)'} · ${c.categoria}`}
                      valor={formatBRL(c.valor)}
                    />
                  ))}
                </div>
              </details>
            </>
          )}

          <details style={{ margin: '10px 0' }}>
            <summary>Estoque inicial — {resultado.inicial.linhas.length} produtos com custo</summary>
            <ListaEstoque linhas={resultado.inicial.linhas} />
          </details>
          <details style={{ margin: '10px 0' }}>
            <summary>Estoque final — {resultado.final.linhas.length} produtos com custo</summary>
            <ListaEstoque linhas={resultado.final.linhas} />
          </details>
        </>
      )}

      {lancandoFaturamento && (
        <FaturamentoModal
          inicialIso={periodo.fim < hoje ? periodo.fim : hoje}
          onClose={() => setLancandoFaturamento(false)}
          onSaved={recarregarFaturamento}
        />
      )}
      {editandoCustos && <CustosEstoqueModal onClose={() => setEditandoCustos(false)} onSaved={() => undefined} />}
    </div>
  )
}

function CmvCard({ titulo, valor, detalhe, destaque }: { titulo: string; valor: string; detalhe: string; destaque?: boolean }) {
  return (
    <div className="fin-resumo-card">
      <span className="fin-resumo-titulo">{titulo}</span>
      <strong className="fin-resumo-valor" style={{ color: destaque ? 'var(--gold-bright)' : 'var(--text-primary)' }}>
        {valor}
      </strong>
      <span className="fin-resumo-qtd">{detalhe}</span>
    </div>
  )
}

function LinhaConta({ rotulo, apoio, valor, forte }: { rotulo: string; apoio?: string; valor: string; forte?: boolean }) {
  return (
    <div className="manage-row" style={{ alignItems: 'center', gap: 12 }}>
      <div className="manage-row-info">
        <strong>{rotulo}</strong>
        {apoio && <span>{apoio}</span>}
      </div>
      <strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: forte ? '1.1rem' : undefined, whiteSpace: 'nowrap' }}>{valor}</strong>
    </div>
  )
}

function ListaEstoque({ linhas }: { linhas: LinhaEstoque[] }) {
  if (linhas.length === 0) return <div className="empty-state">Nenhum produto com saldo e custo.</div>
  return (
    <div className="manage-list" style={{ marginTop: 8 }}>
      {linhas.map((l) => (
        <LinhaConta
          key={l.itemId}
          rotulo={l.titulo}
          apoio={`${formatQuantidade(l.quantidade)} ${l.unidade.toLowerCase()} × ${l.custo == null ? '—' : formatCusto(l.custo)}`}
          valor={formatBRL(l.valor)}
        />
      ))}
    </div>
  )
}
