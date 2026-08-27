import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isManager, useAuthStore } from '../../store/authStore'
import { formatWeekdayLong, weekdayNameForDate } from '../../lib/date'
import { RESERVA_PERIODOS, RESERVA_STATUS, RESERVA_STATUS_BADGE_CLASS, RESERVA_STATUS_LABELS } from './reservaConstants'
import { groupReservasByData } from './reservaHelpers'
import { RESERVAS_KEY, useReservaCapacidade, useReservas, useReservasRealtime } from './useReservas'
import { ReservaFormModal } from './ReservaFormModal'
import { ReservaCapacidadeModal } from './ReservaCapacidadeModal'
import type { ReservaPeriodo, ReservaRow, ReservaStatus } from '../../types/database'

export function ReservasPage() {
  const profile = useAuthStore((s) => s.profile)
  const canManage = isManager(profile, undefined)
  const queryClient = useQueryClient()

  const { data: reservas, isLoading } = useReservas()
  const { data: capacidades } = useReservaCapacidade()
  useReservasRealtime()

  const [busca, setBusca] = useState('')
  const [filtroData, setFiltroData] = useState('')
  const [filtroPeriodo, setFiltroPeriodo] = useState<ReservaPeriodo | 'Todos'>('Todos')
  const [filtroStatus, setFiltroStatus] = useState<ReservaStatus | 'Todos'>('Todos')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<ReservaRow | null>(null)
  const [showCapacidade, setShowCapacidade] = useState(false)

  const hasFiltros = !!(busca.trim() || filtroData || filtroPeriodo !== 'Todos' || filtroStatus !== 'Todos')

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return (reservas ?? [])
      .filter((r) => !termo || r.nome_cliente.toLowerCase().includes(termo))
      .filter((r) => !filtroData || r.data === filtroData)
      .filter((r) => filtroPeriodo === 'Todos' || r.periodo === filtroPeriodo)
      .filter((r) => filtroStatus === 'Todos' || r.status === filtroStatus)
  }, [reservas, busca, filtroData, filtroPeriodo, filtroStatus])

  const grupos = useMemo(() => groupReservasByData(filtradas), [filtradas])

  function limparFiltros() {
    setBusca('')
    setFiltroData('')
    setFiltroPeriodo('Todos')
    setFiltroStatus('Todos')
  }

  if (isLoading) return <div className="empty-state">Carregando…</div>

  return (
    <div className="container">
      <div className="checklist-header">
        <div>
          <h2 className="page-title">Reservas</h2>
          <p className="page-subtitle">Agenda do salão</p>
        </div>
        {canManage && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <button className="btn btn-ghost" onClick={() => setShowCapacidade(true)}>
              Capacidade
            </button>
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              + Nova Reserva
            </button>
          </div>
        )}
      </div>

      <div className="reserva-filters">
        <input type="text" placeholder="Buscar por nome do cliente..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        <input type="date" value={filtroData} onChange={(e) => setFiltroData(e.target.value)} />
        <select value={filtroPeriodo} onChange={(e) => setFiltroPeriodo(e.target.value as ReservaPeriodo | 'Todos')}>
          <option value="Todos">Todos os períodos</option>
          {RESERVA_PERIODOS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value as ReservaStatus | 'Todos')}>
          <option value="Todos">Todos os status</option>
          {RESERVA_STATUS.map((s) => (
            <option key={s} value={s}>
              {RESERVA_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        {hasFiltros && (
          <button type="button" className="btn btn-ghost" onClick={limparFiltros}>
            Limpar filtros
          </button>
        )}
      </div>

      {grupos.length === 0 && <div className="empty-state">Nenhuma reserva encontrada.</div>}

      {grupos.map((grupo) => {
        const data = new Date(`${grupo.data}T00:00:00`)
        return (
          <div className="reserva-day-card" key={grupo.data}>
            <div className="reserva-day-header">{formatWeekdayLong(data, weekdayNameForDate(data))}</div>
            <div className="reserva-day-periodos">
              {RESERVA_PERIODOS.filter((p) => grupo.porPeriodo[p].length > 0).map((p) => (
                <div className="reserva-slot" key={p}>
                  <div className="reserva-slot-header">
                    <span className="reserva-slot-periodo">{p}</span>
                    <span className="reserva-slot-count">
                      {grupo.porPeriodo[p].length} {grupo.porPeriodo[p].length === 1 ? 'reserva' : 'reservas'}
                    </span>
                  </div>
                  <div className="reserva-slot-items">
                    {grupo.porPeriodo[p].map((r) => (
                      <ReservaSlotItem key={r.id} reserva={r} clickable={canManage} onClick={() => setEditing(r)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {(creating || editing) && (
        <ReservaFormModal
          reserva={editing}
          allReservas={reservas ?? []}
          capacidades={capacidades ?? []}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={async () => {
            setCreating(false)
            setEditing(null)
            await queryClient.invalidateQueries({ queryKey: RESERVAS_KEY, exact: false })
          }}
        />
      )}

      {showCapacidade && <ReservaCapacidadeModal onClose={() => setShowCapacidade(false)} />}
    </div>
  )
}

function ReservaSlotItem({ reserva, clickable, onClick }: { reserva: ReservaRow; clickable: boolean; onClick: () => void }) {
  // Telefone/Instagram só aparecem pra quem gerencia — Atendente vê o resto
  // normalmente, mas sem esse contato do cliente (mesmo texto/regra do
  // protótipo). Email nunca aparece nesta lista pra ninguém (só no formulário).
  const contatoBits: string[] = []
  if (clickable && reserva.telefone) contatoBits.push(`Tel: ${reserva.telefone}`)
  if (clickable && reserva.instagram) contatoBits.push(`Instagram: ${reserva.instagram}`)

  return (
    <div
      className={`reserva-slot-item ${clickable ? 'reserva-slot-item-clickable' : ''}`}
      onClick={clickable ? onClick : undefined}
    >
      <div className="reserva-slot-item-top">
        <strong>
          {reserva.horario?.slice(0, 5)} · {reserva.nome_cliente}
        </strong>
        <span className={`badge-status ${RESERVA_STATUS_BADGE_CLASS[reserva.status]}`}>
          {RESERVA_STATUS_LABELS[reserva.status]}
        </span>
      </div>
      <div className="reserva-slot-item-meta">
        {reserva.quantidade_pessoas} {reserva.quantidade_pessoas === 1 ? 'pessoa' : 'pessoas'}
        {reserva.mesa ? ` · Mesa ${reserva.mesa}` : ''}
      </div>
      {contatoBits.length > 0 && <div className="reserva-slot-item-meta">{contatoBits.join(' · ')}</div>}
      {reserva.observacoes && <div className="reserva-slot-item-obs">{reserva.observacoes}</div>}
    </div>
  )
}
