import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { confirmar } from '../../store/confirmStore'
import { rotuloSetorDestino, situacaoDestino } from './notificacaoHelpers'
import {
  NOTIFICACAO_DESTINOS_KEY,
  TELEGRAM_STATUS_KEY,
  ativarBot,
  atualizarDestino,
  criarDestino,
  enviarResumoAgora,
  enviarTeste,
  excluirDestino,
  novoCodigoDestino,
  useNotificacaoDestinos,
  useTelegramStatus,
} from './useNotificacoes'
import type { NotificacaoDestinoRow, Setor } from '../../types/database'

const SETORES: Setor[] = ['Bar', 'Cozinha', 'Salão']
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const mensagemErro = (err: unknown, padrao: string) => (err instanceof Error ? err.message : padrao)

// Avisos do Checklist no Telegram. Administrador e Gestor Geral.
export function NotificacoesPage() {
  const queryClient = useQueryClient()
  const { data: destinos, isLoading } = useNotificacaoDestinos()
  const status = useTelegramStatus()

  const [nome, setNome] = useState('')
  const [setor, setSetor] = useState<Setor | ''>('')
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function recarregar() {
    await queryClient.invalidateQueries({ queryKey: NOTIFICACAO_DESTINOS_KEY })
  }

  async function executar(acao: () => Promise<void>, padrao: string) {
    setErro(null)
    setOcupado(true)
    try {
      await acao()
    } catch (err) {
      setErro(mensagemErro(err, padrao))
    } finally {
      setOcupado(false)
    }
  }

  const criar = (e: FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) return
    void executar(async () => {
      await criarDestino(nome, setor || null)
      setNome('')
      setSetor('')
      await recarregar()
    }, 'Erro ao criar o destino.')
  }

  const ativar = () =>
    executar(async () => {
      await ativarBot()
      await queryClient.invalidateQueries({ queryKey: TELEGRAM_STATUS_KEY })
    }, 'Não foi possível ativar o bot.')

  const resumoAgora = () =>
    executar(async () => {
      if (!(await confirmar('Enviar agora o resumo de pendências de ontem para todos os destinos conectados?'))) return
      const r = await enviarResumoAgora()
      window.alert(
        r.falhas.length
          ? `Enviado para ${r.enviadas}. Falhou em: ${r.falhas.map((f) => `${f.destino} (${f.motivo})`).join('; ')}`
          : `Resumo enviado para ${r.enviadas} ${r.enviadas === 1 ? 'destino' : 'destinos'}.`,
      )
    }, 'Não foi possível enviar o resumo.')

  return (
    <div className="container">
      <div className="checklist-header">
        <div>
          <h2 className="page-title">Notificações</h2>
          <p className="page-subtitle">Avisos do Checklist no Telegram: tarefa concluída e, às 5h05, o que ficou pendente no dia anterior.</p>
        </div>
      </div>

      <h3 className="section-label">Bot do Telegram</h3>
      <div className="manage-row" style={{ display: 'block' }}>
        {status.isLoading && <span className="field-hint">Verificando…</span>}
        {status.error && (
          <>
            <p className="login-error">{mensagemErro(status.error, 'Não foi possível verificar o bot.')}</p>
            <p className="field-hint">
              Para criar o bot: no Telegram, fale com <strong>@BotFather</strong>, envie <code>/newbot</code> e guarde o token
              como segredo do servidor (<code>TELEGRAM_BOT_TOKEN</code>).
            </p>
          </>
        )}
        {status.data && (
          <>
            <strong>@{status.data.bot}</strong>{' '}
            <span className={`badge-status ${status.data.webhook_ativo ? 'badge-status-ativa' : 'badge-status-pendente'}`}>
              {status.data.webhook_ativo ? 'Pronto para conectar grupos' : 'Falta ativar'}
            </span>
            {!status.data.webhook_ativo && (
              <div style={{ marginTop: 8 }}>
                <p className="field-hint">Ative uma vez para o bot passar a entender o comando /ativar nos grupos.</p>
                <button type="button" className="btn btn-primary" disabled={ocupado} onClick={ativar}>
                  Ativar o bot
                </button>
              </div>
            )}
            {status.data.ultimo_erro && <p className="field-hint">Último erro do Telegram: {status.data.ultimo_erro}</p>}
          </>
        )}
      </div>

      <h3 className="section-label" style={{ marginTop: 24 }}>
        Quem recebe os avisos
      </h3>
      <form onSubmit={criar} className="manage-row" style={{ display: 'block' }}>
        <div className="field-row">
          <div className="field">
            <label>Nome do grupo ou pessoa *</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Gestão, Bar, Dono" maxLength={60} />
          </div>
          <div className="field">
            <label>Recebe avisos de</label>
            <select value={setor} onChange={(e) => setSetor(e.target.value as Setor | '')}>
              <option value="">Todos os setores</option>
              {SETORES.map((s) => (
                <option key={s} value={s}>
                  Só {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button type="submit" className="btn btn-primary" disabled={ocupado || !nome.trim()}>
          Adicionar e gerar código
        </button>
      </form>

      {erro && <p className="login-error">{erro}</p>}
      {isLoading && <div className="empty-state">Carregando…</div>}
      {!isLoading && (destinos ?? []).length === 0 && <div className="empty-state">Nenhum destino ainda. Adicione um acima.</div>}

      <div className="manage-list" style={{ marginTop: 12 }}>
        {(destinos ?? []).map((d) => (
          <DestinoCard key={d.id} destino={d} onChange={recarregar} onErro={setErro} />
        ))}
      </div>

      {(destinos ?? []).some((d) => d.chat_id != null) && (
        <button type="button" className="btn btn-ghost" style={{ marginTop: 16 }} disabled={ocupado} onClick={resumoAgora}>
          Enviar agora o resumo de pendências de ontem
        </button>
      )}
    </div>
  )
}

function DestinoCard({ destino: d, onChange, onErro }: { destino: NotificacaoDestinoRow; onChange: () => Promise<void>; onErro: (m: string | null) => void }) {
  const [ocupado, setOcupado] = useState(false)
  const situacao = situacaoDestino(d)

  async function rodar(acao: () => Promise<void>, padrao: string) {
    onErro(null)
    setOcupado(true)
    try {
      await acao()
      await onChange()
    } catch (err) {
      onErro(mensagemErro(err, padrao))
    } finally {
      setOcupado(false)
    }
  }

  const alternar = (campo: 'avisar_conclusoes' | 'avisar_pendencias' | 'ativo') =>
    rodar(() => atualizarDestino(d.id, { [campo]: !d[campo] }), 'Erro ao salvar.')

  const excluir = () =>
    rodar(async () => {
      if (!(await confirmar(`Remover "${d.nome}" dos avisos? O chat deixa de receber mensagens.`))) return
      await excluirDestino(d.id)
    }, 'Erro ao remover.')

  return (
    <div className="manage-row" style={{ display: 'block' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <strong>{d.nome}</strong>
        <span className="field-hint" style={{ display: 'inline' }}>
          {rotuloSetorDestino(d.setor)}
        </span>
        {situacao === 'conectado' && <span className="badge-status badge-status-ativa">Conectado{d.chat_nome ? ` · ${d.chat_nome}` : ''}</span>}
        {situacao === 'aguardando' && <span className="badge-status badge-status-pendente">Aguardando conexão</span>}
        {situacao === 'codigo_expirado' && <span className="badge-status badge-status-bloqueada">Código expirado</span>}
      </div>

      {situacao === 'aguardando' && d.codigo_ativacao && d.codigo_expira_em && (
        <p className="field-hint">
          No Telegram, adicione o bot ao grupo (ou abra uma conversa com ele) e envie: <strong>/ativar {d.codigo_ativacao}</strong> — vale até{' '}
          {hora(d.codigo_expira_em)}.
        </p>
      )}

      {situacao === 'conectado' && (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', margin: '8px 0' }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={d.ativo} disabled={ocupado} onChange={() => alternar('ativo')} /> Ativo
          </label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={d.avisar_conclusoes} disabled={ocupado} onChange={() => alternar('avisar_conclusoes')} /> Tarefa concluída
          </label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={d.avisar_pendencias} disabled={ocupado} onChange={() => alternar('avisar_pendencias')} /> Pendências do dia (5h05)
          </label>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
        {situacao === 'conectado' && (
          <button type="button" className="btn btn-ghost" disabled={ocupado} onClick={() => rodar(async () => void (await enviarTeste(d.id)), 'Não foi possível enviar o teste.')}>
            Enviar teste
          </button>
        )}
        {situacao !== 'aguardando' ? (
          <button type="button" className="btn btn-ghost" disabled={ocupado} onClick={() => rodar(() => novoCodigoDestino(d.id), 'Erro ao gerar o código.')}>
            {situacao === 'conectado' ? 'Trocar o chat (novo código)' : 'Gerar novo código'}
          </button>
        ) : (
          <button type="button" className="btn btn-ghost" disabled={ocupado} onClick={() => rodar(() => novoCodigoDestino(d.id), 'Erro ao gerar o código.')}>
            Gerar outro código
          </button>
        )}
        <button type="button" className="btn btn-ghost" disabled={ocupado} onClick={excluir}>
          Remover
        </button>
      </div>
    </div>
  )
}
