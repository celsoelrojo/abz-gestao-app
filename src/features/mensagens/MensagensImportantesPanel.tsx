import { useMemo, useState } from 'react'
import { isManager, useAuthStore } from '../../store/authStore'
import { isoDate } from '../../lib/date'
import { estoqueItemCritico, validadeProxima } from '../estoque/estoqueHelpers'
import { visibleCategorias } from '../estoque/estoqueAccess'
import { useEstoqueItens } from '../estoque/useEstoque'
import { estoqueCriticoTexto, estoqueValidadeTexto, freelancersResumoTexto, reservasResumoTexto } from './mensagensHelpers'
import { useFreelancersResumoHoje, useMensagens, useMensagensRealtime, useReservasResumoHoje } from './useMensagens'
import { ManageMensagensModal } from './ManageMensagensModal'

const todayIso = isoDate(new Date())

// Painel do topo da Home — espelha renderMessages() do protótipo: alertas
// automáticos (estoque crítico/validade, resumo de reservas, resumo de
// freelancers da Cozinha) seguidos das mensagens manuais, nessa ordem exata.
// Diferente do protótipo (que não tinha nada disso de verdade — era tudo
// recalculado a cada render em memória, sem realtime cross-usuário), aqui as
// mensagens manuais atualizam ao vivo via Supabase Realtime.
export function MensagensImportantesPanel() {
  const profile = useAuthStore((s) => s.profile)
  const canManage = isManager(profile, undefined)
  const isCozinha = profile?.role === 'gestor_cozinha' || profile?.role === 'cozinha'

  const { data: mensagens, isLoading } = useMensagens()
  useMensagensRealtime()
  const { data: reservasResumo } = useReservasResumoHoje()
  const { data: freelancersResumo } = useFreelancersResumoHoje(isCozinha)
  const { data: itens } = useEstoqueItens()

  const setores = useMemo(() => visibleCategorias(profile), [profile])

  const estoqueCriticoText = useMemo(() => {
    if (!canManage || !itens) return null
    const titulos = itens.filter((it) => setores.includes(it.categoria) && estoqueItemCritico(it)).map((it) => it.title)
    return estoqueCriticoTexto(titulos)
  }, [canManage, itens, setores])

  const estoqueValidadeText = useMemo(() => {
    if (!canManage || !itens) return null
    const proximos = itens
      .filter((it) => setores.includes(it.categoria) && validadeProxima(it, todayIso))
      .map((it) => ({ title: it.title, validade: it.validade! }))
    return estoqueValidadeTexto(proximos, todayIso)
  }, [canManage, itens, setores])

  const reservasText = reservasResumo ? reservasResumoTexto(reservasResumo.almoco, reservasResumo.noite) : null
  const freelancersText =
    isCozinha && freelancersResumo ? freelancersResumoTexto(freelancersResumo.almoco, freelancersResumo.noite) : null

  const [manageOpen, setManageOpen] = useState(false)

  const hasAutoAlert = !!(estoqueCriticoText || estoqueValidadeText || reservasText || freelancersText)
  const hasContent = hasAutoAlert || (mensagens && mensagens.length > 0)

  return (
    <section className="messages-box">
      <div className="messages-box-header">
        <h2>Mensagens importantes</h2>
        {canManage && (
          <button className="btn btn-ghost" onClick={() => setManageOpen(true)}>
            Gerenciar Mensagens
          </button>
        )}
      </div>
      <ul className="messages-list">
        {estoqueCriticoText && (
          <li className="message-item message-item-critico">
            <div className="message-item-top">
              <div className="message-item-content">{estoqueCriticoText}</div>
              <span className="message-destino-badge">Estoque</span>
            </div>
          </li>
        )}
        {estoqueValidadeText && (
          <li className="message-item">
            <div className="message-item-top">
              <div className="message-item-content">{estoqueValidadeText}</div>
              <span className="message-destino-badge">Validade</span>
            </div>
          </li>
        )}
        {reservasText && (
          <li className="message-item message-item-reserva">
            <div className="message-item-top">
              <div className="message-item-content">{reservasText}</div>
              <span className="message-destino-badge">Reservas</span>
            </div>
          </li>
        )}
        {freelancersText && (
          <li className="message-item message-item-reserva">
            <div className="message-item-top">
              <div className="message-item-content">{freelancersText}</div>
              <span className="message-destino-badge">Freelancers</span>
            </div>
          </li>
        )}
        {mensagens?.map((m) => (
          <li className="message-item" key={m.id}>
            <div className="message-item-top">
              <div className="message-item-content">{m.content}</div>
              <span className="message-destino-badge">{m.destino}</span>
            </div>
            <div className="message-item-meta">
              Por {m.author_nome} · {new Date(m.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
            </div>
          </li>
        ))}
        {!hasContent && !isLoading && <li className="empty-state">Nenhum aviso no momento.</li>}
      </ul>

      {manageOpen && <ManageMensagensModal onClose={() => setManageOpen(false)} />}
    </section>
  )
}
