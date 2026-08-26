import { useState, type FormEvent } from 'react'
import { useAuthStore } from '../../store/authStore'
import { formatDateBR } from '../../lib/date'
import { supabase } from '../../lib/supabaseClient'
import { RESERVA_OCASIOES, RESERVA_ORIGENS, RESERVA_PERIODOS, RESERVA_STATUS, RESERVA_STATUS_LABELS } from './reservaConstants'
import { buildHistoricoEntries, reservaFormError, reservaSlotStats } from './reservaHelpers'
import type { ReservaPeriodo, ReservaRow, ReservaCapacidadeRow, ReservaStatus } from '../../types/database'

export function ReservaFormModal({
  reserva,
  allReservas,
  capacidades,
  onClose,
  onSaved,
}: {
  reserva: ReservaRow | null
  allReservas: ReservaRow[]
  capacidades: ReservaCapacidadeRow[]
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const profile = useAuthStore((s) => s.profile)

  const [nomeCliente, setNomeCliente] = useState(reserva?.nome_cliente ?? '')
  const [quantidadePessoas, setQuantidadePessoas] = useState(reserva?.quantidade_pessoas?.toString() ?? '')
  const [data, setData] = useState(reserva?.data ?? '')
  const [horario, setHorario] = useState(reserva?.horario?.slice(0, 5) ?? '')
  const [periodo, setPeriodo] = useState<ReservaPeriodo>(reserva?.periodo ?? 'Almoço')
  const [telefone, setTelefone] = useState(reserva?.telefone ?? '')
  const [instagram, setInstagram] = useState(reserva?.instagram ?? '')
  const [email, setEmail] = useState(reserva?.email ?? '')
  const [origem, setOrigem] = useState(reserva?.origem ?? '')
  const [mesa, setMesa] = useState(reserva?.mesa ?? '')
  const [ocasiao, setOcasiao] = useState(reserva?.ocasiao ?? '')
  const [observacoes, setObservacoes] = useState(reserva?.observacoes ?? '')
  const [restricoes, setRestricoes] = useState(reserva?.restricoes ?? '')
  const [responsavel, setResponsavel] = useState(reserva?.responsavel ?? profile?.nome ?? '')
  const [sinal, setSinal] = useState(reserva?.sinal ?? '')
  const [status, setStatus] = useState<ReservaStatus>(reserva?.status ?? 'pendente')
  const [motivoCancelamento, setMotivoCancelamento] = useState(reserva?.motivo_cancelamento ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [capacityConfirm, setCapacityConfirm] = useState<string | null>(null)

  const quantidadeNum = Number(quantidadePessoas)

  async function doSave(): Promise<boolean> {
    setError(null)
    const now = new Date().toISOString()
    const payload = {
      nome_cliente: nomeCliente.trim(),
      telefone: telefone.trim() || null,
      instagram: instagram.trim() || null,
      email: email.trim() || null,
      origem: origem || null,
      data,
      horario,
      periodo,
      quantidade_pessoas: quantidadeNum,
      mesa: mesa.trim() || null,
      ocasiao: ocasiao || null,
      observacoes: observacoes.trim() || null,
      restricoes: restricoes.trim() || null,
      responsavel: responsavel.trim() || null,
      status,
      sinal: sinal.trim() || null,
      motivo_cancelamento: status === 'cancelada' ? motivoCancelamento.trim() : null,
    }

    if (reserva) {
      const historicoNovo = buildHistoricoEntries(
        { status: reserva.status, mesa: reserva.mesa },
        { status, mesa: payload.mesa, motivoCancelamento: payload.motivo_cancelamento },
        profile?.nome ?? '',
        now,
      )
      const canceladaAgora = status === 'cancelada' && reserva.status !== 'cancelada'
      const { error: updateError } = await supabase
        .from('reservas')
        .update({
          ...payload,
          historico: [...reserva.historico, ...historicoNovo],
          ...(canceladaAgora ? { cancelada_por: profile?.nome ?? null, cancelada_em: now } : {}),
        })
        .eq('id', reserva.id)
      if (updateError) {
        setError(updateError.message)
        return false
      }
    } else {
      const { error: insertError } = await supabase.from('reservas').insert({
        ...payload,
        criado_por: profile?.nome ?? null,
        historico: [],
      })
      if (insertError) {
        setError(insertError.message)
        return false
      }
    }
    return true
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const validationError = reservaFormError({
      nomeCliente,
      data,
      horario,
      periodo,
      quantidadePessoas: quantidadeNum,
      status,
      motivoCancelamento,
    })
    if (validationError) {
      setError(validationError)
      return
    }

    // Ultrapassar a capacidade nunca bloqueia — só avisa e pede confirmação.
    if (status !== 'cancelada') {
      const capacidadeMax = capacidades.find((c) => c.periodo === periodo)?.capacidade ?? 0
      const stats = reservaSlotStats(allReservas, data, periodo, reserva?.id)
      const totalComEssa = stats.totalPessoas + quantidadeNum
      if (totalComEssa > capacidadeMax) {
        setCapacityConfirm(
          `Isso ultrapassa a capacidade configurada para ${periodo} em ${formatDateBR(data)} (${totalComEssa} de ${capacidadeMax} pessoas). Deseja salvar mesmo assim?`,
        )
        return
      }
    }

    setSubmitting(true)
    try {
      if (await doSave()) await onSaved()
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmOverCapacity() {
    setCapacityConfirm(null)
    setSubmitting(true)
    try {
      if (await doSave()) await onSaved()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal modal-wide">
        <div className="modal-header">
          <h3>{reserva ? 'Editar reserva' : 'Nova reserva'}</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="field-row">
            <div className="field">
              <label>Nome do cliente *</label>
              <input value={nomeCliente} onChange={(e) => setNomeCliente(e.target.value)} required />
            </div>
            <div className="field">
              <label>Quantidade de pessoas *</label>
              <input type="number" min="1" value={quantidadePessoas} onChange={(e) => setQuantidadePessoas(e.target.value)} required />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Data da reserva *</label>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
            </div>
            <div className="field">
              <label>Horário *</label>
              <input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} required />
            </div>
            <div className="field">
              <label>Período *</label>
              <div className="sector-filter">
                {RESERVA_PERIODOS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`sector-filter-btn ${periodo === p ? 'active' : ''}`}
                    onClick={() => setPeriodo(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <h4 className="section-label">Contato e origem</h4>
          <div className="field-row">
            <div className="field">
              <label>Telefone/WhatsApp</label>
              <input value={telefone} onChange={(e) => setTelefone(e.target.value)} />
            </div>
            <div className="field">
              <label>Instagram</label>
              <input value={instagram} onChange={(e) => setInstagram(e.target.value)} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>E-mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label>Origem da reserva</label>
              <select value={origem} onChange={(e) => setOrigem(e.target.value)}>
                <option value="">Selecione...</option>
                {RESERVA_ORIGENS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <h4 className="section-label">Mesa e ocasião</h4>
          <div className="field-row">
            <div className="field">
              <label>Mesa desejada/atribuída</label>
              <input value={mesa} onChange={(e) => setMesa(e.target.value)} />
            </div>
            <div className="field">
              <label>Ocasião especial</label>
              <select value={ocasiao} onChange={(e) => setOcasiao(e.target.value)}>
                <option value="">Nenhuma</option>
                {RESERVA_OCASIOES.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Observações do cliente</label>
            <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
          </div>
          <div className="field">
            <label>Restrições alimentares, acessibilidade ou necessidades especiais</label>
            <textarea value={restricoes} onChange={(e) => setRestricoes(e.target.value)} rows={2} />
          </div>

          <h4 className="section-label">Controle interno</h4>
          <div className="field-row">
            <div className="field">
              <label>Responsável pelo registro</label>
              <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
            </div>
            <div className="field">
              <label>Sinal / pagamento antecipado</label>
              <input value={sinal} onChange={(e) => setSinal(e.target.value)} placeholder="Ex: R$ 50 via Pix" />
            </div>
          </div>
          <div className="field">
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as ReservaStatus)}>
              {RESERVA_STATUS.map((s) => (
                <option key={s} value={s}>
                  {RESERVA_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          {status === 'cancelada' && (
            <div className="field">
              <label>Motivo do cancelamento *</label>
              <textarea value={motivoCancelamento} onChange={(e) => setMotivoCancelamento(e.target.value)} rows={2} required />
            </div>
          )}

          {reserva && reserva.historico.length > 0 && (
            <div className="field">
              <label>Histórico</label>
              <div className="manage-list">
                {reserva.historico.map((h, i) => (
                  <div className="task-meta" key={i}>
                    {new Date(h.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · {h.autor} · {h.tipo}
                    {h.detalhe ? ` · ${h.detalhe}` : ''}
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p className="login-error">{error}</p>}

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>

      {capacityConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Capacidade excedida</h3>
            </div>
            <div className="modal-body">
              <p>{capacityConfirm}</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setCapacityConfirm(null)}>
                Revisar reserva
              </button>
              <button type="button" className="btn btn-primary" onClick={confirmOverCapacity} disabled={submitting}>
                Salvar mesmo assim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
