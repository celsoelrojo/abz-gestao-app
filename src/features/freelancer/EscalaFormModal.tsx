import { useMemo, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { isoDate } from '../../lib/date'
import { useFreelancers } from './useFreelancers'
import type { FreelancerEscalaRow, ReservaPeriodo, Setor } from '../../types/database'

const SETORES: Setor[] = ['Bar', 'Cozinha', 'Salão']
const PERIODOS: ReservaPeriodo[] = ['Almoço', 'Noite']

export function EscalaFormModal({
  escala,
  onClose,
  onSaved,
}: {
  escala: FreelancerEscalaRow | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const isEdit = !!escala
  const { data: freelancers } = useFreelancers()
  const ativos = useMemo(() => (freelancers ?? []).filter((f) => f.status === 'ativo').sort((a, b) => a.nome.localeCompare(b.nome)), [freelancers])

  const [freelancerId, setFreelancerId] = useState(escala?.freelancer_id ?? '')
  const [data, setData] = useState(escala?.data ?? isoDate(new Date()))
  const [setor, setSetor] = useState<Setor>(escala?.setor ?? 'Bar')
  const [periodo, setPeriodo] = useState<ReservaPeriodo>(escala?.periodo ?? 'Almoço')
  const [horaInicio, setHoraInicio] = useState(escala?.hora_inicio ?? '')
  const [horaFim, setHoraFim] = useState(escala?.hora_fim ?? '')
  const [valorPagamento, setValorPagamento] = useState(escala?.valor_pagamento?.toString() ?? '')
  const [funcaoTurno, setFuncaoTurno] = useState(escala?.funcao_turno ?? '')
  const [observacoes, setObservacoes] = useState(escala?.observacoes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const isValid = !!freelancerId && !!data

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isValid) return
    setError(null)
    setSubmitting(true)
    try {
      const payload = {
        freelancer_id: freelancerId,
        data,
        setor,
        periodo,
        hora_inicio: horaInicio || null,
        hora_fim: horaFim || null,
        valor_pagamento: valorPagamento === '' ? null : Number(valorPagamento),
        funcao_turno: funcaoTurno.trim() || null,
        observacoes: observacoes.trim() || null,
      }
      const { error: saveError } = escala
        ? await supabase.from('freelancer_escalas').update(payload).eq('id', escala.id)
        : await supabase.from('freelancer_escalas').insert(payload)
      if (saveError) {
        setError(saveError.message)
        return
      }
      await onSaved()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>{isEdit ? 'Editar escala' : 'Nova escala'}</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="field">
            <label>Freelancer *</label>
            <select
              value={freelancerId}
              onChange={(e) => {
                setFreelancerId(e.target.value)
                const f = ativos.find((x) => x.id === e.target.value)
                if (f) setSetor(f.setor)
              }}
              required
            >
              <option value="">Selecione...</option>
              {ativos.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Data *</label>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
            </div>
            <div className="field">
              <label>Setor *</label>
              <select value={setor} onChange={(e) => setSetor(e.target.value as Setor)}>
                {SETORES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Período *</label>
              <select value={periodo} onChange={(e) => setPeriodo(e.target.value as ReservaPeriodo)}>
                {PERIODOS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Hora início</label>
              <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
            </div>
            <div className="field">
              <label>Hora fim</label>
              <input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
            </div>
            <div className="field">
              <label>Valor do pagamento (R$)</label>
              <input type="number" value={valorPagamento} onChange={(e) => setValorPagamento(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Função no turno</label>
            <input value={funcaoTurno} onChange={(e) => setFuncaoTurno(e.target.value)} />
          </div>
          <div className="field">
            <label>Observações</label>
            <textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>

          <p className="field-hint">
            Salvar cria ou atualiza automaticamente a tarefa "Pagar freelancer" no Checklist — nunca altera um pagamento já concluído.
          </p>

          {error && <p className="login-error">{error}</p>}

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={!isValid || submitting}>
              {submitting ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar escala'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
