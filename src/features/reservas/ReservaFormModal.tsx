import { useState, type FormEvent } from 'react'
import { useAuthStore } from '../../store/authStore'
import { formatDateBR } from '../../lib/date'
import { supabase } from '../../lib/supabaseClient'
import { RESERVA_ORIGENS, RESERVA_PERIODOS, RESERVA_STATUS, RESERVA_STATUS_LABELS } from './reservaConstants'
import { buildHistoricoEntries, reservaFormError, reservaSlotStats } from './reservaHelpers'
import { buscarClientePorWhatsapp, type ClienteEncontrado } from './useReservas'
import { formatarWhatsapp, normalizarWhatsapp } from './whatsapp'
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
  // O campo de telefone da reserva passou a ser o WhatsApp do cliente — o
  // identificador dele nas reservas e no banco de clientes.
  const [whatsapp, setWhatsapp] = useState(
    reserva?.telefone ? formatarWhatsapp(normalizarWhatsapp(reserva.telefone) ?? reserva.telefone) : '',
  )
  const [origem, setOrigem] = useState(reserva?.origem ?? '')
  const [primeiraVez, setPrimeiraVez] = useState<'sim' | 'nao' | ''>(
    reserva?.primeira_vez == null ? '' : reserva.primeira_vez ? 'sim' : 'nao',
  )
  // Quando a pessoa escolhe "primeira vez" na mão, a busca pelo WhatsApp não
  // sobrescreve mais a escolha.
  const [primeiraVezManual, setPrimeiraVezManual] = useState(reserva?.primeira_vez != null)
  const [clienteInfo, setClienteInfo] = useState<
    { tipo: 'novo' } | ({ tipo: 'existente' } & ClienteEncontrado) | null
  >(null)
  const [mesa, setMesa] = useState(reserva?.mesa ?? '')
  const [observacoes, setObservacoes] = useState(reserva?.observacoes ?? '')
  const [acompanhamentoObs, setAcompanhamentoObs] = useState(reserva?.acompanhamento_obs ?? '')
  const [status, setStatus] = useState<ReservaStatus>(reserva?.status ?? 'pendente')
  const [motivoCancelamento, setMotivoCancelamento] = useState(reserva?.motivo_cancelamento ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [capacityConfirm, setCapacityConfirm] = useState<string | null>(null)

  const quantidadeNum = Number(quantidadePessoas)

  // Ao sair do campo WhatsApp: procura o cliente no banco. Se já veio antes,
  // reconhece (e completa o nome, se estava vazio) e marca "não é a primeira
  // vez"; se não existe, é cliente novo. Não sobrescreve uma escolha manual.
  async function reconhecerCliente() {
    const numero = normalizarWhatsapp(whatsapp)
    if (!numero) {
      setClienteInfo(null)
      return
    }
    setWhatsapp(formatarWhatsapp(numero))
    try {
      const achado = await buscarClientePorWhatsapp(numero, reserva?.id)
      if (!achado) {
        setClienteInfo({ tipo: 'novo' })
        if (!primeiraVezManual) setPrimeiraVez('sim')
        return
      }
      setClienteInfo({ tipo: 'existente', ...achado })
      if (!nomeCliente.trim()) setNomeCliente(achado.nome)
      if (!primeiraVezManual) setPrimeiraVez(achado.reservasAnteriores > 0 ? 'nao' : 'sim')
    } catch {
      // Sem a busca o formulário continua funcionando — só não pré-preenche.
      setClienteInfo(null)
    }
  }

  async function doSave(): Promise<boolean> {
    setError(null)
    const now = new Date().toISOString()
    const payload = {
      nome_cliente: nomeCliente.trim(),
      // Normalizado (só dígitos, sem o 55) — o banco guarda do mesmo jeito e
      // usa como chave do cliente. Reserva antiga com contato em texto livre
      // mantém o que tinha se a pessoa não digitou um número válido.
      telefone: normalizarWhatsapp(whatsapp) ?? (whatsapp.trim() || null),
      origem: origem || null,
      primeira_vez: primeiraVez === '' ? null : primeiraVez === 'sim',
      data,
      horario,
      periodo,
      quantidade_pessoas: quantidadeNum,
      mesa: mesa.trim() || null,
      observacoes: observacoes.trim() || null,
      acompanhamento_obs: acompanhamentoObs.trim() || null,
      status,
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
        // Campos que saíram do formulário não são mais pedidos; o "responsável
        // pelo registro" passa a ser quem criou, sem precisar digitar.
        responsavel: profile?.nome ?? null,
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
      whatsapp,
      exigeWhatsapp: !reserva || !!reserva.telefone,
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
          <h4 className="section-label">Identificação do cliente</h4>
          <div className="field-row">
            <div className="field">
              <label>Nome do cliente *</label>
              <input value={nomeCliente} onChange={(e) => setNomeCliente(e.target.value)} required />
            </div>
            <div className="field">
              <label>WhatsApp *</label>
              <input
                type="tel"
                inputMode="tel"
                value={whatsapp}
                onChange={(e) => {
                  setWhatsapp(e.target.value)
                  setClienteInfo(null)
                }}
                onBlur={reconhecerCliente}
                placeholder="(79) 98149-5581"
              />
              {clienteInfo?.tipo === 'existente' && (
                <span className="field-hint">
                  Cliente já cadastrado: {clienteInfo.nome} ·{' '}
                  {clienteInfo.reservasAnteriores === 0
                    ? 'sem reservas anteriores'
                    : `${clienteInfo.reservasAnteriores} ${clienteInfo.reservasAnteriores === 1 ? 'reserva anterior' : 'reservas anteriores'}`}
                </span>
              )}
              {clienteInfo?.tipo === 'novo' && <span className="field-hint">Cliente novo — será cadastrado com esta reserva.</span>}
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Quantidade de pessoas *</label>
              <input type="number" min="1" value={quantidadePessoas} onChange={(e) => setQuantidadePessoas(e.target.value)} required />
            </div>
            <div className="field">
              <label>Data da reserva *</label>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
            </div>
            <div className="field">
              <label>Horário *</label>
              <input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} required />
            </div>
          </div>
          <div className="field-row">
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
            <div className="field">
              <label>Primeira vez do cliente na casa?</label>
              <div className="sector-filter">
                {(['sim', 'nao'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`sector-filter-btn ${primeiraVez === v ? 'active' : ''}`}
                    onClick={() => {
                      setPrimeiraVez(v)
                      setPrimeiraVezManual(true)
                    }}
                  >
                    {v === 'sim' ? 'Sim' : 'Não'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <h4 className="section-label">Mesa e observações</h4>
          <div className="field">
            <label>Mesa desejada</label>
            <input value={mesa} onChange={(e) => setMesa(e.target.value)} />
          </div>
          <div className="field">
            <label>Observações do cliente</label>
            <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
          </div>

          <h4 className="section-label">Controle interno</h4>
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
          <div className="field">
            <label>Observação pós-reserva (a fazer depois da reserva)</label>
            <textarea
              value={acompanhamentoObs}
              onChange={(e) => setAcompanhamentoObs(e.target.value)}
              rows={2}
              placeholder="Ex.: ligar agradecendo a visita, enviar convite de retorno..."
            />
            <span className="field-hint">
              Preenchida, vira uma tarefa de acompanhamento no Checklist do Salão, no dia seguinte à reserva — só a Gestão
              do Salão e o Administrador veem.
            </span>
          </div>

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
