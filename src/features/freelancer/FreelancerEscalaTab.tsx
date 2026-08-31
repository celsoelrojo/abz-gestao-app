import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { confirmar } from '../../store/confirmStore'
import { isoDate, formatWeekdayLong, weekdayNameForDate } from '../../lib/date'
import { getWeekDates } from '../checklist/scheduling'
import { FREELANCER_ESCALAS_KEY, useFreelancerEscalas, useFreelancers } from './useFreelancers'
import { EscalaFormModal } from './EscalaFormModal'
import type { FreelancerEscalaRow, ReservaPeriodo, Setor } from '../../types/database'

const SETORES: Setor[] = ['Bar', 'Cozinha', 'Salão']
const PERIODOS: ReservaPeriodo[] = ['Almoço', 'Noite']

const today = new Date()
const todayIso = isoDate(today)
const weekDays = getWeekDates(today).filter((d) => isoDate(d) !== todayIso)

export function FreelancerEscalaTab() {
  const queryClient = useQueryClient()
  const { data: escalas, isLoading } = useFreelancerEscalas()
  const { data: freelancers } = useFreelancers()
  const [setorFiltro, setSetorFiltro] = useState<'Todos' | Setor>('Todos')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<FreelancerEscalaRow | null>(null)

  const nomeDoFreelancer = useMemo(() => {
    const map = new Map<string, string>()
    ;(freelancers ?? []).forEach((f) => map.set(f.id, f.nome))
    return map
  }, [freelancers])

  const filtradas = useMemo(
    () => (escalas ?? []).filter((e) => setorFiltro === 'Todos' || e.setor === setorFiltro),
    [escalas, setorFiltro],
  )

  const hoje = useMemo(() => filtradas.filter((e) => e.data === todayIso), [filtradas])
  const semana = useMemo(
    () =>
      weekDays
        .map((d) => {
          const dateIso = isoDate(d)
          return { date: d, dateIso, weekday: weekdayNameForDate(d), escalas: filtradas.filter((e) => e.data === dateIso) }
        })
        .filter((g) => g.escalas.length > 0),
    [filtradas],
  )

  async function refetch() {
    await queryClient.invalidateQueries({ queryKey: FREELANCER_ESCALAS_KEY })
  }

  async function excluir(e: FreelancerEscalaRow) {
    if (!(await confirmar('Excluir esta escala? Se o pagamento ainda não foi feito, a tarefa correspondente no Checklist também é apagada.')))
      return
    const { error } = await supabase.from('freelancer_escalas').delete().eq('id', e.id)
    if (error) {
      window.alert(error.message)
      return
    }
    await refetch()
  }

  function periodoBlocks(escalasDoDia: FreelancerEscalaRow[]) {
    return PERIODOS.map((p) => ({ periodo: p, escalas: escalasDoDia.filter((e) => e.periodo === p) })).filter(
      (b) => b.escalas.length > 0,
    )
  }

  function renderEscalaRow(e: FreelancerEscalaRow) {
    return (
      <div className="manage-row" key={e.id}>
        <div className="manage-row-info">
          <strong>{nomeDoFreelancer.get(e.freelancer_id) ?? '—'}</strong>
          <span>
            {e.setor} · {e.periodo}
            {e.hora_inicio || e.hora_fim ? ` · ${e.hora_inicio ?? '—'}–${e.hora_fim ?? '—'}` : ''}
            {e.funcao_turno ? ` · ${e.funcao_turno}` : ''}
            {e.valor_pagamento != null ? ` · R$ ${e.valor_pagamento.toFixed(2)}` : ''}
          </span>
        </div>
        <div className="manage-row-actions">
          <button className="icon-btn" onClick={() => setEditing(e)} title="Editar">
            ✎
          </button>
          <button className="icon-btn danger" onClick={() => excluir(e)} title="Excluir">
            🗑
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="field" style={{ maxWidth: 220, marginBottom: 12 }}>
        <label>Setor</label>
        <select value={setorFiltro} onChange={(e) => setSetorFiltro(e.target.value as 'Todos' | Setor)}>
          <option value="Todos">Todos</option>
          {SETORES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <button className="btn btn-primary" onClick={() => setCreating(true)}>
        + Nova Escala
      </button>

      {isLoading && <div className="empty-state">Carregando…</div>}

      <div className="today-section" style={{ marginTop: 20 }}>
        <h3 className="section-label">Freelancers hoje</h3>
        {hoje.length === 0 ? (
          <div className="empty-state">Nenhum freelancer escalado para hoje.</div>
        ) : (
          periodoBlocks(hoje).map((b) => (
            <div key={b.periodo} style={{ marginBottom: 12 }}>
              <h4 className="section-label">{b.periodo}</h4>
              <div className="manage-list">{b.escalas.map(renderEscalaRow)}</div>
            </div>
          ))
        )}
      </div>

      <h3 className="section-label" style={{ marginTop: 20 }}>
        Escala da semana
      </h3>
      {semana.length === 0 && <div className="empty-state">Nenhuma escala para os próximos dias da semana.</div>}
      {semana.map((g) => (
        <div key={g.dateIso} style={{ marginBottom: 20 }}>
          <h4 className="section-label">{formatWeekdayLong(g.date, g.weekday)}</h4>
          {periodoBlocks(g.escalas).map((b) => (
            <div key={b.periodo} style={{ marginBottom: 12 }}>
              <span className="task-meta">{b.periodo}</span>
              <div className="manage-list">{b.escalas.map(renderEscalaRow)}</div>
            </div>
          ))}
        </div>
      ))}

      {(creating || editing) && (
        <EscalaFormModal
          escala={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={async () => {
            setCreating(false)
            setEditing(null)
            await refetch()
          }}
        />
      )}
    </div>
  )
}
