import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { formatDateBR } from '../../lib/date'
import { confirmar } from '../../store/confirmStore'
import { CotacaoEditor } from './CotacaoEditor'
import { estadoDeCotacao, novaCotacaoVazia, tituloPadrao, type CotacaoComFilhos, type CotacaoEstado } from './cotacaoHelpers'
import { COTACOES_KEY, excluirCotacao, useCotacoes } from './useCotacoes'

// Cotações salvas (rascunhos e finalizadas). Uma cotação nova também nasce da
// Lista de Compras ("Cotar selecionados"). Administrador e Gestor Geral.
export function CotacoesTab() {
  const queryClient = useQueryClient()
  const { data: cotacoes, isLoading, error } = useCotacoes()
  const [aberta, setAberta] = useState<{ estado: CotacaoEstado; somenteLeitura: boolean } | null>(null)

  function abrir(c: CotacaoComFilhos) {
    setAberta({ estado: estadoDeCotacao(c), somenteLeitura: c.status === 'finalizada' })
  }

  async function excluir(c: CotacaoComFilhos) {
    if (!(await confirmar(`Excluir a cotação "${c.titulo ?? 'sem nome'}"? Os pedidos já gerados continuam.`))) return
    try {
      await excluirCotacao(c.id)
      await queryClient.invalidateQueries({ queryKey: COTACOES_KEY })
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Não foi possível excluir.')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <h3 className="page-title" style={{ margin: 0 }}>
          Cotações
        </h3>
        <button type="button" className="btn btn-primary" onClick={() => setAberta({ estado: { ...novaCotacaoVazia(), titulo: tituloPadrao() }, somenteLeitura: false })}>
          Nova cotação
        </button>
      </div>
      <p className="field-hint">
        Compare o preço de cada produto entre fornecedores e gere os pedidos de compra pelo mais barato. Para começar com o que está faltando, use a
        Lista de Compras.
      </p>

      {isLoading && <div className="empty-state">Carregando…</div>}
      {error && <p className="login-error">Não foi possível carregar as cotações.</p>}
      {!isLoading && (cotacoes ?? []).length === 0 && <div className="empty-state">Nenhuma cotação ainda.</div>}

      <div className="manage-list">
        {(cotacoes ?? []).map((c) => (
          <div className="manage-row" key={c.id}>
            <div className="manage-row-info">
              <strong>{c.titulo ?? 'Cotação sem nome'}</strong>
              <span>
                {c.cotacao_itens.length} {c.cotacao_itens.length === 1 ? 'produto' : 'produtos'} · {c.cotacao_fornecedores.length}{' '}
                {c.cotacao_fornecedores.length === 1 ? 'fornecedor' : 'fornecedores'} · criada em {formatDateBR(c.criado_em.slice(0, 10))}
              </span>
              <div className="account-badges">
                <span className={`badge-status ${c.status === 'finalizada' ? 'badge-status-ativa' : 'badge-status-pendente'}`}>
                  {c.status === 'finalizada' ? 'Pedidos gerados' : 'Rascunho'}
                </span>
              </div>
            </div>
            <div className="manage-row-actions">
              <button className="btn btn-ghost" onClick={() => abrir(c)}>
                {c.status === 'finalizada' ? 'Ver' : 'Continuar'}
              </button>
              <button className="icon-btn" title="Excluir" onClick={() => excluir(c)}>
                🗑
              </button>
            </div>
          </div>
        ))}
      </div>

      {aberta && <CotacaoEditor inicial={aberta.estado} somenteLeitura={aberta.somenteLeitura} onClose={() => setAberta(null)} />}
    </div>
  )
}
