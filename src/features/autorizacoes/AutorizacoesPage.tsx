import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { formatDateBR } from '../../lib/date'
import { confirmar } from '../../store/confirmStore'
import { isAdministrador, useAuthStore } from '../../store/authStore'
import { pedidosPendentes, resumirDados, rotuloTabela, STATUS_PEDIDO_LABEL } from './exclusaoHelpers'
import { resolverExclusao, SOLICITACOES_KEY, useSolicitacoes } from './useSolicitacoes'
import type { SolicitacaoExclusaoRow } from '../../types/database'

const dataHora = (iso: string) => `${formatDateBR(iso.slice(0, 10))} ${new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`

// O Gestor Geral não apaga direto: cada exclusão vira um pedido aqui. O
// Administrador decide (aprovar apaga de vez); o Gestor Geral só acompanha os próprios.
export function AutorizacoesPage() {
  const profile = useAuthStore((s) => s.profile)
  const decide = isAdministrador(profile)
  const { data: pedidos, isLoading, error } = useSolicitacoes()

  const pendentes = (pedidos ?? []).filter((p) => p.status === 'pendente')
  const encerrados = (pedidos ?? []).filter((p) => p.status !== 'pendente')

  return (
    <div className="container">
      <div className="checklist-header">
        <div>
          <h2 className="page-title">Autorizações</h2>
          <p className="page-subtitle">
            {decide
              ? 'Pedidos do Gestor Geral para apagar registros. Nada é apagado sem a sua aprovação.'
              : 'Seus pedidos para apagar registros. Só o Administrador pode aprovar.'}
          </p>
        </div>
      </div>

      {isLoading && <div className="empty-state">Carregando…</div>}
      {error && <p className="login-error">Não foi possível carregar os pedidos.</p>}

      <h3 className="section-label">{decide ? 'Aguardando sua decisão' : 'Aguardando o Administrador'} ({pedidosPendentes(pendentes)})</h3>
      {!isLoading && pendentes.length === 0 && <div className="empty-state">Nenhum pedido pendente.</div>}
      <div className="manage-list">
        {pendentes.map((p) => (
          <PedidoCard key={p.id} pedido={p} decide={decide} />
        ))}
      </div>

      {encerrados.length > 0 && (
        <>
          <h3 className="section-label" style={{ marginTop: 28 }}>
            Já decididos
          </h3>
          <div className="manage-list">
            {encerrados.map((p) => (
              <PedidoCard key={p.id} pedido={p} decide={false} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function PedidoCard({ pedido, decide }: { pedido: SolicitacaoExclusaoRow; decide: boolean }) {
  const queryClient = useQueryClient()
  const [detalhes, setDetalhes] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [trabalhando, setTrabalhando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const campos = resumirDados(pedido.dados)

  async function decidir(aprovar: boolean) {
    const pergunta = aprovar
      ? `Aprovar e APAGAR ${rotuloTabela(pedido.tabela)} "${pedido.descricao}"? Esta ação não pode ser desfeita.`
      : `Recusar o pedido para apagar "${pedido.descricao}"? O registro continua como está.`
    if (!(await confirmar(pergunta))) return
    setErro(null)
    setTrabalhando(true)
    try {
      await resolverExclusao(pedido, aprovar, motivo)
      // O registro apagado some de telas que já estavam carregadas.
      await queryClient.invalidateQueries()
      await queryClient.invalidateQueries({ queryKey: SOLICITACOES_KEY })
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível concluir.')
    } finally {
      setTrabalhando(false)
    }
  }

  return (
    <div className="manage-row" style={{ display: 'block' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <strong>{pedido.descricao}</strong>
        <span
          className={`badge-status ${
            pedido.status === 'pendente' ? 'badge-status-pendente' : pedido.status === 'aprovada' ? 'badge-status-bloqueada' : 'badge-status-ativa'
          }`}
        >
          {STATUS_PEDIDO_LABEL[pedido.status]}
        </span>
      </div>
      <span className="field-hint">
        {rotuloTabela(pedido.tabela)} · pedido de {pedido.solicitante_nome} em {dataHora(pedido.created_at)}
        {pedido.resolvido_em && ` · decidido por ${pedido.resolvido_por_nome ?? 'Administrador'} em ${dataHora(pedido.resolvido_em)}`}
      </span>
      {pedido.resposta && <span className="field-hint">Resposta: {pedido.resposta}</span>}

      {campos.length > 0 && (
        <button type="button" className="btn btn-ghost" style={{ marginTop: 6 }} onClick={() => setDetalhes((v) => !v)}>
          {detalhes ? 'Ocultar dados' : 'Ver dados do registro'}
        </button>
      )}
      {detalhes && (
        <dl className="field-hint" style={{ margin: '8px 0 0', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 12px' }}>
          {campos.map((c) => (
            <div key={c.campo} style={{ display: 'contents' }}>
              <dt>{c.campo}</dt>
              <dd style={{ margin: 0 }}>{c.valor}</dd>
            </div>
          ))}
        </dl>
      )}

      {decide && pedido.status === 'pendente' && (
        <div style={{ marginTop: 10 }}>
          <input
            type="text"
            placeholder="Resposta ao Gestor Geral (opcional)"
            value={motivo}
            maxLength={200}
            onChange={(e) => setMotivo(e.target.value)}
          />
          {erro && <p className="login-error">{erro}</p>}
          <div className="modal-footer" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-ghost" disabled={trabalhando} onClick={() => decidir(false)}>
              Recusar
            </button>
            <button type="button" className="btn btn-primary" disabled={trabalhando} onClick={() => decidir(true)}>
              {trabalhando ? 'Aguarde...' : 'Aprovar e apagar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
