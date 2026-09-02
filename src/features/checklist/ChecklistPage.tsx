import { useMemo, useRef, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isFullAdmin, isManager, useAuthStore } from '../../store/authStore'
import { confirmar } from '../../store/confirmStore'
import { formatDateBR, formatWeekdayLong, isoDate, weekdayNameForDate } from '../../lib/date'
import { supabase } from '../../lib/supabaseClient'
import { toPrinterConfig } from '../../lib/printing/mappers'
import { enqueuePrintJob } from '../../lib/printing/printQueue'
import { useEstoqueItens } from '../estoque/useEstoque'
import { useFichasProducao } from '../fichas/useFichasProducao'
import { findOverdueInfo, getUpcomingDays, getWeekDates, isTaskScheduledOn } from './scheduling'
import {
  definirResponsavelDia,
  removerResponsavelDia,
  useChecklistConclusoesRange,
  useChecklistRealtime,
  useChecklistResponsavelDiaRange,
  useChecklistTasks,
  useResponsaveisDisponiveis,
} from './useChecklistTasks'
import { checklistFotoUrl, completeTask, resolveJustificativaAtraso, uncompleteTask } from './completeTask'
import type { CompleteTaskOptions } from './completeTask'
import { ManageChecklistModal } from './ManageChecklistModal'
import { ProducaoConclusaoModal } from './ProducaoConclusaoModal'
import type { IngredienteUsado } from './ProducaoConclusaoModal'
import type {
  ChecklistConclusaoRow,
  ChecklistResponsavelDiaRow,
  ChecklistTaskRow,
  FichaProducaoLoteRow,
  FichaProducaoRow,
  PrinterRow,
  Setor,
} from '../../types/database'

const SETORES: Setor[] = ['Bar', 'Cozinha', 'Salão']

const today = new Date()
const todayIso = isoDate(today)
const week = getWeekDates(today)
const weekStartIso = isoDate(week[0])
const upcomingDays = getUpcomingDays(5, today)
const upcomingEndIso = isoDate(upcomingDays[upcomingDays.length - 1])

function keyFor(taskId: number, dateIso: string) {
  return `${taskId}:${dateIso}`
}

export function ChecklistPage() {
  const profile = useAuthStore((s) => s.profile)
  const queryClient = useQueryClient()
  const { data: tasks, isLoading: loadingTasks } = useChecklistTasks()
  const { data: conclusoesRange, isLoading: loadingConclusoes } = useChecklistConclusoesRange(
    weekStartIso,
    upcomingEndIso,
  )
  const { data: responsavelDiaRange } = useChecklistResponsavelDiaRange(weekStartIso, upcomingEndIso)
  useChecklistRealtime()
  // Só pra montar a caixa de conclusão de tarefas "envolve produção" —
  // precisa da ficha inteira (ingredientes, rendimento) e dos itens de
  // estoque do setor pra sugerir/exibir nome+unidade de cada ingrediente.
  const { data: fichasProducao } = useFichasProducao()
  const { data: estoqueItensTodos } = useEstoqueItens()
  const fichasProducaoById = useMemo(() => new Map((fichasProducao ?? []).map((f) => [f.id, f])), [fichasProducao])

  const [pendingAtraso, setPendingAtraso] = useState<{
    task: ChecklistTaskRow
    missedDate: string
    daysLate: number
  } | null>(null)
  const [pendingAntecipacao, setPendingAntecipacao] = useState<{ task: ChecklistTaskRow; dateIso: string } | null>(
    null,
  )
  const [pendingPhoto, setPendingPhoto] = useState<{
    task: ChecklistTaskRow
    dateIso: string
    extra: CompleteTaskOptions
  } | null>(null)
  const [pendingProducao, setPendingProducao] = useState<{
    task: ChecklistTaskRow
    dateIso: string
    extra: CompleteTaskOptions
    ficha: FichaProducaoRow
  } | null>(null)
  const [pendingEtiqueta, setPendingEtiqueta] = useState<{
    printer: PrinterRow
    producaoNome: string
    condicaoArmazenamento: string | null
    lote: FichaProducaoLoteRow
  } | null>(null)
  const [pendingTrocaResponsavel, setPendingTrocaResponsavel] = useState<{ task: ChecklistTaskRow; dateIso: string } | null>(
    null,
  )
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [manageOpen, setManageOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const visibleTasks = useMemo(() => (tasks ?? []).filter((t) => !t.freelancer_pagamento), [tasks])

  const conclusaoByKey = useMemo(() => {
    const map = new Map<string, ChecklistConclusaoRow>()
    conclusoesRange?.forEach((c) => map.set(keyFor(c.task_id, c.data_referencia), c))
    return map
  }, [conclusoesRange])

  const responsavelOverrideByKey = useMemo(() => {
    const map = new Map<string, ChecklistResponsavelDiaRow>()
    responsavelDiaRange?.forEach((r) => map.set(keyFor(r.task_id, r.data_referencia), r))
    return map
  }, [responsavelDiaRange])

  // Pedido do usuário: trocar o responsável de UMA tarefa só naquele dia,
  // exclusivo de quem gerencia o setor DAQUELA tarefa (Gestor só no
  // próprio, Administrador em qualquer um — mesma regra de is_manager já
  // usada no resto do Checklist). Tarefa de pagamento de freelancer nunca
  // entra (não é uma atribuição de equipe de verdade).
  function podeTrocarResponsavel(task: ChecklistTaskRow): boolean {
    return !task.freelancer_pagamento && isManager(profile, task.setor)
  }
  function responsavelEfetivo(task: ChecklistTaskRow, dateIso: string): string {
    return responsavelOverrideByKey.get(keyFor(task.id, dateIso))?.responsavel_nome ?? task.responsavel_nome
  }

  const completedDatesByTask = useMemo(() => {
    const map = new Map<number, string[]>()
    conclusoesRange?.forEach((c) => {
      const arr = map.get(c.task_id) ?? []
      arr.push(c.data_referencia)
      map.set(c.task_id, arr)
    })
    return map
  }, [conclusoesRange])

  const overdueByTaskId = useMemo(() => {
    const map = new Map<number, { missedDate: string; daysLate: number }>()
    visibleTasks.forEach((t) => {
      const info = findOverdueInfo(t, week, today, completedDatesByTask.get(t.id) ?? [])
      if (info) map.set(t.id, info)
    })
    return map
  }, [visibleTasks, completedDatesByTask])

  // Seção exclusiva do Administrador — "Pagar freelancer" é sincronizada
  // automaticamente pela Escala (trigger no banco) e nunca aparece nas listas
  // por setor de ninguém, nem pode ser editada em "Gerenciar Checklist".
  const freelancerPagamentoTasks = useMemo(
    () =>
      (tasks ?? [])
        .filter((t) => t.freelancer_pagamento && t.active)
        .sort((a, b) => (a.data_unica ?? '').localeCompare(b.data_unica ?? '')),
    [tasks],
  )
  const overdueByFreelancerTaskId = useMemo(() => {
    const map = new Map<number, { missedDate: string; daysLate: number }>()
    freelancerPagamentoTasks.forEach((t) => {
      const info = findOverdueInfo(t, week, today, completedDatesByTask.get(t.id) ?? [])
      if (info) map.set(t.id, info)
    })
    return map
  }, [freelancerPagamentoTasks, completedDatesByTask])

  // Tarefas concluídas hoje com justificativa de atraso — ficam visíveis no
  // painel "Tarefas Atrasadas" (só pra quem gerencia) até serem apagadas.
  // Isso é independente de a tarefa estar programada pra hoje: uma tarefa
  // Semanal (só segunda) concluída atrasada numa quinta não aparece em
  // nenhum outro lugar, então precisa aparecer aqui.
  const lateResolvedToday = useMemo(() => {
    return (conclusoesRange ?? [])
      .filter((c) => c.data_referencia === todayIso && c.justificativa_atraso)
      .filter((c) => isFullAdmin(profile) || !c.justificativa_atraso_dismissed)
      .map((c) => ({ conclusao: c, task: visibleTasks.find((t) => t.id === c.task_id) }))
      .filter((e): e is { conclusao: ChecklistConclusaoRow; task: ChecklistTaskRow } => !!e.task)
  }, [conclusoesRange, visibleTasks, profile])

  const todayGroups = useMemo(() => {
    const scheduledToday = visibleTasks.filter((t) => isTaskScheduledOn(t, today) && !overdueByTaskId.has(t.id))
    const groups = new Map<string, ChecklistTaskRow[]>()
    scheduledToday.forEach((t) => {
      if (!groups.has(t.setor)) groups.set(t.setor, [])
      groups.get(t.setor)!.push(t)
    })
    return [...groups.entries()]
  }, [visibleTasks, overdueByTaskId])

  // Administrador vê tarefas de todos os setores misturadas — sem sinalizar
  // de qual setor é cada uma, fica ambíguo. Gestor de setor e perfis de
  // setor só enxergam o próprio setor (RLS), então a separação não faz
  // diferença pra eles e a lista fica simples (só por dia).
  const showSetorBadges = isFullAdmin(profile)

  function buildUpcomingDayGroups(tasksForSetor: ChecklistTaskRow[]) {
    return upcomingDays
      .map((date) => {
        const dateIso = isoDate(date)
        const dayTasks = tasksForSetor.filter((t) => isTaskScheduledOn(t, date))
        return { date, dateIso, weekday: weekdayNameForDate(date), tasks: dayTasks }
      })
      .filter((g) => g.tasks.length > 0)
  }

  const upcomingGroups = useMemo(() => buildUpcomingDayGroups(visibleTasks), [visibleTasks])

  const upcomingGroupsBySetor = useMemo(() => {
    if (!showSetorBadges) return null
    return SETORES.map((setor) => ({
      setor,
      days: buildUpcomingDayGroups(visibleTasks.filter((t) => t.setor === setor)),
    })).filter((block) => block.days.length > 0)
  }, [visibleTasks, showSetorBadges])

  const canManage = isManager(profile, undefined)

  async function refetchConclusoes() {
    await queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'checklist_conclusoes' })
  }

  async function proceedToComplete(task: ChecklistTaskRow, dateIso: string, extra: CompleteTaskOptions) {
    // envolve_producao e foto_obrigatoria são mutuamente exclusivos (ver
    // ManageChecklistModal) — por isso a ordem entre os dois checks abaixo
    // não importa na prática, mas produção vem primeiro por ser o fluxo mais
    // específico.
    if (task.envolve_producao && !extra.producao) {
      const ficha = task.producao_vinculada_id ? fichasProducaoById.get(task.producao_vinculada_id) : undefined
      if (!ficha) {
        window.alert('Ficha de produção vinculada não encontrada (ou ainda carregando). Tente novamente em instantes.')
        return
      }
      setPendingProducao({ task, dateIso, extra, ficha })
      return
    }
    if (task.foto_obrigatoria && !extra.photoFile) {
      setPendingPhoto({ task, dateIso, extra })
      fileInputRef.current?.click()
      return
    }
    if (!profile) return
    setBusyKey(keyFor(task.id, dateIso))
    try {
      const result = await completeTask(task, dateIso, profile.id, extra)
      await refetchConclusoes()
      if (result.loteId) await offerLabelPrint(task, result.loteId)
    } catch (err) {
      // Sem isso, um erro do RPC (ex.: produto remanufaturado não cadastrado,
      // saldo insuficiente de um ingrediente) ficava só como unhandled
      // rejection no console — a tarefa simplesmente não marcava como
      // concluída e nada acontecia no Estoque, sem nenhum aviso na tela.
      window.alert(err instanceof Error ? err.message : 'Erro ao concluir a tarefa.')
    } finally {
      setBusyKey(null)
    }
  }

  // Etiqueta é opcional e só oferecida se houver impressora ativa cadastrada
  // — sem isso, a produção continua registrada normalmente, só sem etiqueta.
  // A quantidade agora é perguntada (caixa "Imprimir etiqueta"), não mais
  // fixa em 1 — pedido do usuário.
  async function offerLabelPrint(task: ChecklistTaskRow, loteId: string) {
    if (!profile || !task.producao_vinculada_id) return
    const [{ data: printers }, { data: producao }, { data: lote }] = await Promise.all([
      supabase.from('printers').select('*').eq('ativa', true).order('nome').limit(1),
      supabase.from('fichas_producao').select('nome, condicao_armazenamento').eq('id', task.producao_vinculada_id).maybeSingle(),
      supabase.from('fichas_producao_lotes').select('*').eq('id', loteId).maybeSingle(),
    ])
    const printer = printers?.[0]
    if (!printer || !producao || !lote) return
    setPendingEtiqueta({ printer, producaoNome: producao.nome, condicaoArmazenamento: producao.condicao_armazenamento, lote })
  }

  async function handleEtiquetaConfirm(quantidadeEtiquetas: number) {
    if (!pendingEtiqueta || !profile) return
    const { printer, producaoNome, condicaoArmazenamento, lote } = pendingEtiqueta
    setPendingEtiqueta(null)
    await enqueuePrintJob({
      printer: toPrinterConfig(printer),
      lote_id: lote.id,
      quantidade_etiquetas: quantidadeEtiquetas,
      data: {
        produto: producaoNome,
        preparo: new Date(lote.data_hora_producao).toLocaleString('pt-BR'),
        validade: lote.data_hora_validade ? new Date(lote.data_hora_validade).toLocaleString('pt-BR') : '—',
        armazenar: condicaoArmazenamento ?? '—',
        responsavel: lote.responsavel,
        quantidade: lote.quantidade_produzida,
      },
      responsavel_id: profile.id,
      responsavel_nome: profile.nome,
    })
  }

  function handleProducaoConfirm(rendimento: number, ingredientes: IngredienteUsado[]) {
    if (!pendingProducao) return
    const { task, dateIso, extra } = pendingProducao
    setPendingProducao(null)
    proceedToComplete(task, dateIso, { ...extra, producao: { rendimento, ingredientes } })
  }

  async function handleToggle(task: ChecklistTaskRow, dateIso: string) {
    if (!profile) return
    const existing = conclusaoByKey.get(keyFor(task.id, dateIso))
    if (existing) {
      setBusyKey(keyFor(task.id, dateIso))
      try {
        await uncompleteTask(task.id, dateIso)
        await refetchConclusoes()
      } catch (err) {
        window.alert(err instanceof Error ? err.message : 'Erro ao desmarcar a tarefa.')
      } finally {
        setBusyKey(null)
      }
      return
    }
    if (dateIso > todayIso) {
      setPendingAntecipacao({ task, dateIso })
      return
    }
    const overdue = dateIso === todayIso ? (overdueByTaskId.get(task.id) ?? overdueByFreelancerTaskId.get(task.id)) : undefined
    if (overdue) {
      setPendingAtraso({ task, missedDate: overdue.missedDate, daysLate: overdue.daysLate })
      return
    }
    await proceedToComplete(task, dateIso, {})
  }

  async function handlePhotoSelected(file: File | undefined) {
    if (!file || !pendingPhoto || !profile) return
    const { task, dateIso, extra } = pendingPhoto
    setPendingPhoto(null)
    setBusyKey(keyFor(task.id, dateIso))
    try {
      await completeTask(task, dateIso, profile.id, { ...extra, photoFile: file })
      await refetchConclusoes()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Erro ao concluir a tarefa.')
    } finally {
      setBusyKey(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDismissAtraso(conclusaoId: string) {
    if (!(await confirmar('Apagar a notificação de atraso? Esta ação não pode ser desfeita.'))) return
    await resolveJustificativaAtraso(conclusaoId)
    await refetchConclusoes()
  }

  if (loadingTasks || loadingConclusoes) {
    return <div className="soon-box">Carregando checklist…</div>
  }

  return (
    <div className="container">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => handlePhotoSelected(e.target.files?.[0])}
      />
      <div className="checklist-header">
        <div>
          <h2 className="page-title">Checklist Diário</h2>
          <p className="page-subtitle">Hoje · {weekdayNameForDate(today)}</p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setManageOpen(true)}>
            ⚙ Gerenciar Checklist
          </button>
        )}
      </div>

      <div className="checklist-categories">
        {isFullAdmin(profile) && freelancerPagamentoTasks.length > 0 && (
          <section className="overdue-section">
            <div className="overdue-section-header">
              <h3 className="overdue-section-title" style={{ color: 'var(--gold-bright)' }}>
                Pagamento de Freelancers
              </h3>
            </div>
            <div className="overdue-tasks-list">
              {freelancerPagamentoTasks.map((t) => {
                const overdue = overdueByFreelancerTaskId.get(t.id)
                // Igual à seção "Tarefas Atrasadas": recuperar um atraso
                // sempre conclui com data_referencia = hoje (a data original
                // perdida fica só na justificativa).
                const dateIso = overdue ? todayIso : (t.data_unica ?? todayIso)
                const conclusao = conclusaoByKey.get(keyFor(t.id, dateIso))
                return (
                  <TaskRow
                    key={t.id}
                    task={t}
                    dateIso={dateIso}
                    completed={!!conclusao}
                    conclusao={conclusao}
                    overdueDaysLate={overdue?.daysLate}
                    busy={busyKey === keyFor(t.id, dateIso)}
                    onToggle={() => handleToggle(t, dateIso)}
                    showAntecipadaBadge={false}
                    isToday={dateIso === todayIso}
                    responsavelNome={responsavelEfetivo(t, dateIso)}
                    canTrocarResponsavel={podeTrocarResponsavel(t)}
                    onTrocarResponsavel={() => setPendingTrocaResponsavel({ task: t, dateIso })}
                  />
                )
              })}
            </div>
          </section>
        )}

        {(overdueByTaskId.size > 0 || lateResolvedToday.length > 0) && (
          <section className="overdue-section">
            <div className="overdue-section-header">
              <h3 className="overdue-section-title">Tarefas Atrasadas</h3>
            </div>
            <div className="overdue-tasks-list">
              {visibleTasks
                .filter((t) => overdueByTaskId.has(t.id))
                .map((t) => {
                  const info = overdueByTaskId.get(t.id)!
                  return (
                    <TaskRow
                      key={`overdue-${t.id}`}
                      task={t}
                      dateIso={todayIso}
                      completed={false}
                      overdueDaysLate={info.daysLate}
                      busy={busyKey === keyFor(t.id, todayIso)}
                      onToggle={() => handleToggle(t, todayIso)}
                      showAntecipadaBadge={false}
                      showSetorBadge={showSetorBadges}
                      responsavelNome={responsavelEfetivo(t, todayIso)}
                      canTrocarResponsavel={podeTrocarResponsavel(t)}
                      onTrocarResponsavel={() => setPendingTrocaResponsavel({ task: t, dateIso: todayIso })}
                    />
                  )
                })}
              {lateResolvedToday.map(({ conclusao, task }) => (
                <div className="task-row task-row-overdue" key={`late-${conclusao.id}`}>
                  <button className="task-checkbox checked" disabled title="Concluída com atraso">
                    ✓
                  </button>
                  <div className="task-main">
                    <div className="task-title-row">
                      <span className="task-title">{task.title}</span>
                      <span className="task-overdue-badge">Atrasada</span>
                      {showSetorBadges && <span className="task-setor-badge">{task.setor}</span>}
                    </div>
                    <div className="task-overdue-meta">
                      Programada para {formatDateBR(conclusao.justificativa_atraso_missed_date)} ·{' '}
                      {conclusao.justificativa_atraso_days_late}{' '}
                      {conclusao.justificativa_atraso_days_late === 1 ? 'dia' : 'dias'} em atraso
                    </div>
                    <div className="task-justificativa-atraso">
                      <strong>Justificativa de atraso:</strong> {conclusao.justificativa_atraso}
                    </div>
                  </div>
                  <div className="task-actions">
                    <button
                      type="button"
                      className="icon-btn danger"
                      title="Apagar notificação"
                      onClick={() => handleDismissAtraso(conclusao.id)}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="today-section">
          {todayGroups.length === 0 && overdueByTaskId.size === 0 && lateResolvedToday.length === 0 && (
            <div className="empty-state">Nenhuma tarefa programada para hoje.</div>
          )}
          {todayGroups.map(([setor, setorTasks]) => (
            <div className="category-block" key={setor}>
              <div className="category-header category-header-static">
                <div className="category-header-left">
                  <span className="category-title">{setor}</span>
                  <span className="category-count">{setorTasks.length}</span>
                </div>
              </div>
              <div className="category-body">
                {setorTasks.map((task) => {
                  const conclusao = conclusaoByKey.get(keyFor(task.id, todayIso))
                  return (
                    <TaskRow
                      key={task.id}
                      task={task}
                      dateIso={todayIso}
                      completed={!!conclusao}
                      conclusao={conclusao}
                      busy={busyKey === keyFor(task.id, todayIso)}
                      onToggle={() => handleToggle(task, todayIso)}
                      showAntecipadaBadge={canManage}
                      isToday
                      responsavelNome={responsavelEfetivo(task, todayIso)}
                      canTrocarResponsavel={podeTrocarResponsavel(task)}
                      onTrocarResponsavel={() => setPendingTrocaResponsavel({ task, dateIso: todayIso })}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </section>

        <section className="upcoming-section">
          <h3 className="section-label">Próximos 5 dias</h3>
          {upcomingGroupsBySetor ? (
            <>
              {upcomingGroupsBySetor.length === 0 && (
                <div className="empty-state">Nenhuma tarefa programada para os próximos 5 dias.</div>
              )}
              {upcomingGroupsBySetor.map((block) => (
                <div className="upcoming-setor-block" key={block.setor}>
                  <h4 className="upcoming-setor-title">{block.setor}</h4>
                  {block.days.map((g) => (
                    <UpcomingDayGroup
                      key={g.dateIso}
                      group={g}
                      conclusaoByKey={conclusaoByKey}
                      busyKey={busyKey}
                      canManage={canManage}
                      onToggle={handleToggle}
                      responsavelEfetivo={responsavelEfetivo}
                      podeTrocarResponsavel={podeTrocarResponsavel}
                      onTrocarResponsavel={(task, dateIso) => setPendingTrocaResponsavel({ task, dateIso })}
                    />
                  ))}
                </div>
              ))}
            </>
          ) : (
            <>
              {upcomingGroups.length === 0 && (
                <div className="empty-state">Nenhuma tarefa programada para os próximos 5 dias.</div>
              )}
              {upcomingGroups.map((g) => (
                <UpcomingDayGroup
                  key={g.dateIso}
                  group={g}
                  conclusaoByKey={conclusaoByKey}
                  busyKey={busyKey}
                  canManage={canManage}
                  onToggle={handleToggle}
                  responsavelEfetivo={responsavelEfetivo}
                  podeTrocarResponsavel={podeTrocarResponsavel}
                  onTrocarResponsavel={(task, dateIso) => setPendingTrocaResponsavel({ task, dateIso })}
                />
              ))}
            </>
          )}
        </section>
      </div>

      {pendingAtraso && (
        <JustificativaModal
          title="Justificativa de atraso"
          message={`"${pendingAtraso.task.title}" estava programada para ${formatDateBR(pendingAtraso.missedDate)} (${pendingAtraso.daysLate} ${pendingAtraso.daysLate === 1 ? 'dia' : 'dias'} em atraso). Explique o motivo para concluir.`}
          onCancel={() => setPendingAtraso(null)}
          onConfirm={(texto) => {
            const { task, missedDate, daysLate } = pendingAtraso
            setPendingAtraso(null)
            proceedToComplete(task, todayIso, { justificativaAtraso: { texto, missedDate, daysLate } })
          }}
        />
      )}

      {pendingAntecipacao && (
        <JustificativaModal
          title="Conclusão antecipada"
          message={`"${pendingAntecipacao.task.title}" está programada para ${formatDateBR(pendingAntecipacao.dateIso)} — uma data futura. Você está concluindo essa tarefa antecipadamente.`}
          onCancel={() => setPendingAntecipacao(null)}
          onConfirm={(texto) => {
            const { task, dateIso } = pendingAntecipacao
            setPendingAntecipacao(null)
            proceedToComplete(task, dateIso, { antecipacao: { justificativa: texto } })
          }}
        />
      )}

      {pendingProducao && (
        <ProducaoConclusaoModal
          ficha={pendingProducao.ficha}
          estoqueItens={(estoqueItensTodos ?? []).filter((it) => it.categoria === pendingProducao.ficha.setor)}
          onCancel={() => setPendingProducao(null)}
          onConfirm={handleProducaoConfirm}
        />
      )}

      {pendingEtiqueta && (
        <EtiquetaModal
          producaoNome={pendingEtiqueta.producaoNome}
          onCancel={() => setPendingEtiqueta(null)}
          onConfirm={handleEtiquetaConfirm}
        />
      )}

      {pendingTrocaResponsavel && (
        <TrocarResponsavelModal
          task={pendingTrocaResponsavel.task}
          dateIso={pendingTrocaResponsavel.dateIso}
          effectiveResponsavelId={
            responsavelOverrideByKey.get(keyFor(pendingTrocaResponsavel.task.id, pendingTrocaResponsavel.dateIso))
              ?.responsavel_id ?? pendingTrocaResponsavel.task.responsavel_id
          }
          onClose={() => setPendingTrocaResponsavel(null)}
        />
      )}

      {manageOpen && <ManageChecklistModal onClose={() => setManageOpen(false)} />}
    </div>
  )
}

interface UpcomingDay {
  date: Date
  dateIso: string
  weekday: string
  tasks: ChecklistTaskRow[]
}

function UpcomingDayGroup({
  group,
  conclusaoByKey,
  busyKey,
  canManage,
  onToggle,
  responsavelEfetivo,
  podeTrocarResponsavel,
  onTrocarResponsavel,
}: {
  group: UpcomingDay
  conclusaoByKey: Map<string, ChecklistConclusaoRow>
  busyKey: string | null
  canManage: boolean
  onToggle: (task: ChecklistTaskRow, dateIso: string) => void
  responsavelEfetivo: (task: ChecklistTaskRow, dateIso: string) => string
  podeTrocarResponsavel: (task: ChecklistTaskRow) => boolean
  onTrocarResponsavel: (task: ChecklistTaskRow, dateIso: string) => void
}) {
  return (
    <div className="week-day-group">
      <div className="week-day-header">{formatWeekdayLong(group.date, group.weekday)}</div>
      <div className="week-day-tasks">
        {group.tasks.map((task) => {
          const conclusao = conclusaoByKey.get(keyFor(task.id, group.dateIso))
          return (
            <TaskRow
              key={task.id}
              task={task}
              dateIso={group.dateIso}
              completed={!!conclusao}
              conclusao={conclusao}
              busy={busyKey === keyFor(task.id, group.dateIso)}
              onToggle={() => onToggle(task, group.dateIso)}
              showAntecipadaBadge={canManage}
              responsavelNome={responsavelEfetivo(task, group.dateIso)}
              canTrocarResponsavel={podeTrocarResponsavel(task)}
              onTrocarResponsavel={() => onTrocarResponsavel(task, group.dateIso)}
            />
          )
        })}
      </div>
    </div>
  )
}

function JustificativaModal({
  title,
  message,
  onCancel,
  onConfirm,
}: {
  title: string
  message: string
  onCancel: () => void
  onConfirm: (texto: string) => void
}) {
  const [texto, setTexto] = useState('')
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onCancel}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p>{message}</p>
          <div className="field">
            <label>Justificativa *</label>
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} />
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!texto.trim()}
            onClick={() => onConfirm(texto.trim())}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

// Última etapa do fluxo de conclusão "envolve produção": pergunta quantas
// etiquetas imprimir em vez do confirm() de sim/não com quantidade fixa em 1
// (pedido do usuário) — "Não imprimir" fecha sem enfileirar nada.
function EtiquetaModal({
  producaoNome,
  onCancel,
  onConfirm,
}: {
  producaoNome: string
  onCancel: () => void
  onConfirm: (quantidade: number) => void
}) {
  const [quantidade, setQuantidade] = useState('1')
  const quantidadeNum = Number(quantidade)
  const isValid = Number.isInteger(quantidadeNum) && quantidadeNum > 0

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isValid) return
    onConfirm(quantidadeNum)
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>Imprimir etiqueta</h3>
          <button className="modal-close" onClick={onCancel}>
            ✕
          </button>
        </div>
        <form className="modal-body" onSubmit={handleSubmit}>
          <p>Quantas etiquetas de "{producaoNome}" devem ser impressas?</p>
          <div className="field">
            <label>Número de etiquetas *</label>
            <input
              type="number"
              min="1"
              step="1"
              autoFocus
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              required
            />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onCancel}>
              Não imprimir
            </button>
            <button type="submit" className="btn btn-primary" disabled={!isValid}>
              Adicionar à fila
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Trocar o responsável de UMA tarefa só naquele dia — pedido do usuário:
// "não é necessário pedir confirmação", então escolher na caixa já salva
// direto (sem passo de confirmar). Escolher o responsável PADRÃO da tarefa
// remove o override do dia (volta a valer o padrão), em vez de gravar uma
// linha redundante.
function TrocarResponsavelModal({
  task,
  dateIso,
  effectiveResponsavelId,
  onClose,
}: {
  task: ChecklistTaskRow
  dateIso: string
  effectiveResponsavelId: string | null
  onClose: () => void
}) {
  const profile = useAuthStore((s) => s.profile)
  const queryClient = useQueryClient()
  const { data: responsaveis, isLoading } = useResponsaveisDisponiveis(task.setor)
  const [selecionado, setSelecionado] = useState(effectiveResponsavelId ?? '')
  const [salvando, setSalvando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleChange(novoId: string) {
    if (!profile || !novoId || novoId === selecionado) return
    const responsavel = responsaveis?.find((r) => r.id === novoId)
    if (!responsavel) return
    setSelecionado(novoId)
    setSalvando(true)
    setError(null)
    try {
      if (novoId === task.responsavel_id) {
        await removerResponsavelDia(task.id, dateIso)
      } else {
        await definirResponsavelDia(task.id, dateIso, responsavel.id, responsavel.nome, profile.id)
      }
      await queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'checklist_responsavel_dia' })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao trocar o responsável.')
      setSalvando(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>Responsável de hoje</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p className="field-hint" style={{ marginBottom: 12 }}>
            "{task.title}" — vale só para {formatDateBR(dateIso)}; o responsável padrão da tarefa não muda.
          </p>
          <div className="field">
            <label>Responsável</label>
            <select value={selecionado} onChange={(e) => handleChange(e.target.value)} disabled={salvando || isLoading} autoFocus>
              <option value="" disabled>
                {isLoading ? 'Carregando...' : 'Selecione...'}
              </option>
              {responsaveis?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                  {r.id === task.responsavel_id ? ' (padrão)' : ''}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="login-error">{error}</p>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={salvando}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

function TaskRow({
  task,
  dateIso,
  completed,
  conclusao,
  overdueDaysLate,
  busy,
  onToggle,
  showAntecipadaBadge,
  showSetorBadge,
  isToday,
  responsavelNome,
  canTrocarResponsavel,
  onTrocarResponsavel,
}: {
  task: ChecklistTaskRow
  dateIso: string
  completed: boolean
  conclusao?: ChecklistConclusaoRow
  overdueDaysLate?: number
  busy: boolean
  onToggle: () => void
  showAntecipadaBadge: boolean
  showSetorBadge?: boolean
  isToday?: boolean
  responsavelNome: string
  canTrocarResponsavel: boolean
  onTrocarResponsavel: () => void
}) {
  const rowClass =
    overdueDaysLate != null
      ? 'task-row task-row-overdue'
      : `task-row ${isToday ? 'task-row-today' : ''} ${completed ? 'completed' : ''}`
  return (
    <div className={rowClass}>
      <button
        className={`task-checkbox ${completed ? 'checked' : ''}`}
        disabled={busy}
        onClick={onToggle}
        title={completed ? 'Marcar como não concluída' : 'Marcar como concluída'}
      >
        {completed ? '✓' : ''}
      </button>
      <div className="task-main">
        <div className="task-title-row">
          <span className="task-title">{task.title}</span>
          {overdueDaysLate != null ? (
            <span className="task-overdue-badge">Atrasada</span>
          ) : (
            isToday && <span className="task-today-badge">Hoje</span>
          )}
          {showSetorBadge && <span className="task-setor-badge">{task.setor}</span>}
          {task.foto_obrigatoria && <span className="badge-foto">Foto obrigatória</span>}
          {task.envolve_producao && <span className="badge-foto">Gera produção</span>}
        </div>
        {overdueDaysLate != null && (
          <div className="task-overdue-meta">
            {overdueDaysLate} {overdueDaysLate === 1 ? 'dia' : 'dias'} em atraso
          </div>
        )}
        {task.description && <div className="task-desc">{task.description}</div>}
        <div className="task-meta">
          <span>{responsavelNome}</span>
        </div>
        {completed && conclusao && (
          <div className="task-completion">
            ✓ Concluída às{' '}
            {new Date(conclusao.completed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            {conclusao.foto_url && (
              <button
                type="button"
                className="photo-view-link"
                onClick={async () => {
                  const url = await checklistFotoUrl(conclusao.foto_url!)
                  window.open(url, '_blank', 'noreferrer')
                }}
              >
                Ver foto
              </button>
            )}
          </div>
        )}
        {completed && conclusao?.justificativa_atraso && (
          <div className="task-justificativa-atraso">
            <strong>Justificativa de atraso:</strong> {conclusao.justificativa_atraso}
          </div>
        )}
        {completed && showAntecipadaBadge && conclusao?.antecipacao_justificativa && (
          <>
            <div className="task-antecipada-badge">Realizada antecipadamente</div>
            <div className="task-justificativa-atraso task-justificativa-antecipada">
              <strong>Programada para {formatDateBR(dateIso)}:</strong> {conclusao.antecipacao_justificativa}
            </div>
          </>
        )}
      </div>
      {canTrocarResponsavel && (
        <div className="task-actions">
          <button type="button" className="icon-btn" title="Trocar responsável só de hoje" onClick={onTrocarResponsavel}>
            👤
          </button>
        </div>
      )}
    </div>
  )
}
