import { useMemo, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isFullAdmin, useAuthStore } from '../../store/authStore'
import { confirmar } from '../../store/confirmStore'
import { supabase } from '../../lib/supabaseClient'
import { toggleSemanaDoMes, toggleValue } from './taskFormHelpers'
import { CHECKLIST_TASKS_ALL_KEY, CHECKLIST_TASKS_KEY, useAllChecklistTasksForManage } from './useChecklistTasks'
import { VINCULO_TIPOS, useVinculoOptions, type VinculoTipo } from '../../lib/vinculo'
import type { ChecklistTaskRow, Periodicidade, Setor, Weekday } from '../../types/database'

const ALL_WEEKDAYS: Weekday[] = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
const PERIODICIDADES: Periodicidade[] = ['A cada turno', 'Diária', 'Semanal', 'Quinzenal', 'Mensal', 'Única']
const SEMANA_MES_OPTIONS: { value: string; label: string }[] = [
  { value: '1', label: '1ª' },
  { value: '2', label: '2ª' },
  { value: '3', label: '3ª' },
  { value: '4', label: '4ª' },
  { value: '5', label: '5ª' },
  { value: 'ultima', label: 'Última' },
]

export function ManageChecklistModal({ onClose }: { onClose: () => void }) {
  const profile = useAuthStore((s) => s.profile)
  const queryClient = useQueryClient()
  const admin = isFullAdmin(profile)
  const profileSetor = profile?.setor ?? null
  const visibleSetores: Setor[] = useMemo(
    () => (admin ? ['Bar', 'Cozinha', 'Salão'] : profileSetor ? [profileSetor] : []),
    [admin, profileSetor],
  )

  const tasksQuery = useAllChecklistTasksForManage()
  const [editingTask, setEditingTask] = useState<ChecklistTaskRow | null>(null)
  const [creating, setCreating] = useState(false)

  const bySetor = useMemo(() => {
    const map = new Map<Setor, ChecklistTaskRow[]>()
    visibleSetores.forEach((s) => map.set(s, []))
    ;(tasksQuery.data ?? [])
      .filter((t) => !t.freelancer_pagamento && visibleSetores.includes(t.setor))
      .forEach((t) => map.get(t.setor)!.push(t))
    return map
  }, [tasksQuery.data, visibleSetores])

  async function refetch() {
    await queryClient.invalidateQueries({ queryKey: CHECKLIST_TASKS_ALL_KEY })
    await queryClient.invalidateQueries({ queryKey: CHECKLIST_TASKS_KEY })
  }

  async function moveTask(setorTasks: ChecklistTaskRow[], index: number, direction: 'up' | 'down') {
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    const a = setorTasks[index]
    const b = setorTasks[swapIndex]
    if (!a || !b) return
    await supabase.from('checklist_tasks').update({ posicao: b.posicao }).eq('id', a.id)
    await supabase.from('checklist_tasks').update({ posicao: a.posicao }).eq('id', b.id)
    await refetch()
  }

  async function toggleActive(task: ChecklistTaskRow) {
    await supabase.from('checklist_tasks').update({ active: !task.active }).eq('id', task.id)
    await refetch()
  }

  async function deleteTask(task: ChecklistTaskRow) {
    if (!(await confirmar(`Excluir a tarefa "${task.title}"? Esta ação não pode ser desfeita.`))) return
    const { error } = await supabase.from('checklist_tasks').delete().eq('id', task.id)
    if (error) {
      window.alert(error.message)
      return
    }
    await refetch()
  }

  const showForm = creating || !!editingTask

  return (
    <div className="modal-overlay">
      <div className="modal modal-wide">
        <div className="modal-header">
          <h3>Gerenciar Checklist</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <button className="btn btn-primary" style={{ marginBottom: 16 }} onClick={() => setCreating(true)}>
            + Adicionar tarefa
          </button>
          {tasksQuery.isLoading && <div className="empty-state">Carregando…</div>}
          {[...bySetor.entries()].map(([setor, setorTasks]) => (
            <div key={setor} style={{ marginBottom: 20 }}>
              <h4 className="section-label">{setor}</h4>
              <div className="manage-list">
                {setorTasks.length === 0 && <div className="empty-state">Nenhuma tarefa cadastrada.</div>}
                {setorTasks.map((task, idx) => (
                  <div className={`manage-row ${task.active ? '' : 'inactive'}`} key={task.id}>
                    <div className="manage-row-info">
                      <strong>{task.title}</strong>
                      <span>
                        {task.periodicidade} · {task.responsavel_nome}
                        {task.vinculo_tipo ? ` · Vínculo: ${task.vinculo_tipo}` : ''}
                        {!task.active ? ' · inativa' : ''}
                      </span>
                    </div>
                    <div className="manage-row-actions">
                      <button
                        className="icon-btn"
                        disabled={idx === 0}
                        onClick={() => moveTask(setorTasks, idx, 'up')}
                        title="Mover para cima"
                      >
                        ↑
                      </button>
                      <button
                        className="icon-btn"
                        disabled={idx === setorTasks.length - 1}
                        onClick={() => moveTask(setorTasks, idx, 'down')}
                        title="Mover para baixo"
                      >
                        ↓
                      </button>
                      <button
                        className="icon-btn"
                        onClick={() => toggleActive(task)}
                        title={task.active ? 'Desativar' : 'Ativar'}
                      >
                        {task.active ? '👁' : '🚫'}
                      </button>
                      <button className="icon-btn" onClick={() => setEditingTask(task)} title="Editar">
                        ✎
                      </button>
                      {admin && (
                        <button className="icon-btn danger" onClick={() => deleteTask(task)} title="Excluir">
                          🗑
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showForm && (
        <TaskFormModal
          task={editingTask}
          defaultSetor={admin ? 'Bar' : (profile?.setor ?? 'Bar')}
          lockedSetor={admin ? null : (profile?.setor ?? null)}
          onClose={() => {
            setCreating(false)
            setEditingTask(null)
          }}
          onSaved={async () => {
            setCreating(false)
            setEditingTask(null)
            await refetch()
          }}
        />
      )}
    </div>
  )
}

function TaskFormModal({
  task,
  defaultSetor,
  lockedSetor,
  onClose,
  onSaved,
}: {
  task: ChecklistTaskRow | null
  defaultSetor: Setor
  lockedSetor: Setor | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!task
  const [setor, setSetor] = useState<Setor>(task?.setor ?? lockedSetor ?? defaultSetor)
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [responsavelNome, setResponsavelNome] = useState(task?.responsavel_nome ?? '')
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>(task?.periodicidade ?? 'Diária')
  const [dias, setDias] = useState<Weekday[]>(task?.dias ?? [])
  const [semanasDoMes, setSemanasDoMes] = useState<string[]>(task?.semanas_do_mes ?? [])
  const [dataUnica, setDataUnica] = useState(task?.data_unica ?? '')
  const [fotoObrigatoria, setFotoObrigatoria] = useState(task?.foto_obrigatoria ?? false)
  const [active, setActive] = useState(task?.active ?? true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [vinculoTipo, setVinculoTipo] = useState<VinculoTipo | ''>((task?.vinculo_tipo as VinculoTipo) || '')
  const [vinculoId, setVinculoId] = useState(task?.vinculo_id ?? '')
  const vinculoOptions = useVinculoOptions(vinculoTipo || null, setor)

  // Mutuamente exclusivo com foto obrigatória: uma tarefa que envolve
  // produção nunca também pede foto (o registro do lote já é a evidência).
  const [envolveProducao, setEnvolveProducao] = useState(task?.envolve_producao ?? false)
  const [producaoVinculadaId, setProducaoVinculadaId] = useState(task?.producao_vinculada_id ?? '')
  const { data: producoesDoSetor } = useQuery({
    queryKey: ['fichas_producao_publicadas', setor],
    enabled: envolveProducao,
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('fichas_producao')
        .select('id, nome')
        .eq('status', 'publicada')
        .eq('setor', setor)
      if (qError) throw qError
      return data as { id: string; nome: string }[]
    },
  })

  // Diferente do rascunho anterior: TODA periodicidade exceto Única pede os
  // dias da semana (inclusive Diária/"A cada turno" — o protótipo sempre
  // mostrou esse campo pra qualquer periodicidade selecionada, ver
  // updateTaskPeriodicidadeFields em script.js:4551).
  const needsDiasPicker = periodicidade !== 'Única'
  const needsSemanaMes = periodicidade === 'Mensal' || periodicidade === 'Quinzenal'
  const semanaMesMax = periodicidade === 'Mensal' ? 1 : 2

  const isValid =
    !!title.trim() &&
    !!responsavelNome.trim() &&
    (periodicidade !== 'Única' || !!dataUnica) &&
    (!needsDiasPicker || dias.length > 0) &&
    (!needsSemanaMes || semanasDoMes.length === semanaMesMax) &&
    (!envolveProducao || !!producaoVinculadaId)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isValid) return
    setError(null)
    setSubmitting(true)
    try {
      const payload = {
        setor,
        title: title.trim(),
        description: description.trim(),
        responsavel_nome: responsavelNome.trim(),
        periodicidade,
        dias: periodicidade === 'Única' ? [] : dias,
        data_unica: periodicidade === 'Única' ? dataUnica : null,
        semanas_do_mes: needsSemanaMes ? semanasDoMes : [],
        vinculo_tipo: vinculoTipo || null,
        vinculo_id: vinculoTipo && vinculoId ? vinculoId : null,
        envolve_producao: envolveProducao,
        producao_vinculada_id: envolveProducao ? producaoVinculadaId : null,
        foto_obrigatoria: envolveProducao ? false : fotoObrigatoria,
        active,
      }
      const { error: saveError } = task
        ? await supabase.from('checklist_tasks').update(payload).eq('id', task.id)
        : await supabase.from('checklist_tasks').insert(payload)
      if (saveError) {
        setError(saveError.message)
        return
      }
      onSaved()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal modal-wide">
        <div className="modal-header">
          <h3>{isEdit ? 'Editar tarefa' : 'Nova tarefa'}</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="field-row">
            <div className="field">
              <label>Setor *</label>
              <select
                value={setor}
                onChange={(e) => {
                  setSetor(e.target.value as Setor)
                  setVinculoId('')
                  setProducaoVinculadaId('')
                }}
                disabled={!!lockedSetor}
              >
                {(['Bar', 'Cozinha', 'Salão'] as Setor[]).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Responsável *</label>
              <input value={responsavelNome} onChange={(e) => setResponsavelNome(e.target.value)} required />
            </div>
          </div>

          <div className="field">
            <label>Título *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div className="field">
            <label>Descrição</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          <div className="field">
            <label>Periodicidade *</label>
            <select value={periodicidade} onChange={(e) => setPeriodicidade(e.target.value as Periodicidade)}>
              {PERIODICIDADES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {needsDiasPicker && (
            <div className="field">
              <label>Dias da semana *</label>
              <div className="sector-filter">
                {ALL_WEEKDAYS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`sector-filter-btn ${dias.includes(d) ? 'active' : ''}`}
                    onClick={() => setDias((prev) => toggleValue(prev, d))}
                  >
                    {d.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {needsSemanaMes && (
            <div className="field">
              <label>{periodicidade === 'Mensal' ? 'Semana do mês (escolha 1) *' : 'Semanas do mês (escolha 2) *'}</label>
              <div className="sector-filter">
                {SEMANA_MES_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`sector-filter-btn ${semanasDoMes.includes(opt.value) ? 'active' : ''}`}
                    onClick={() => setSemanasDoMes((prev) => toggleSemanaDoMes(prev, opt.value, semanaMesMax))}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {periodicidade === 'Única' && (
            <div className="field">
              <label>Data *</label>
              <input type="date" value={dataUnica} onChange={(e) => setDataUnica(e.target.value)} required />
            </div>
          )}

          <div className="field-row">
            <div className="field">
              <label>Vínculo</label>
              <select
                value={vinculoTipo}
                onChange={(e) => {
                  setVinculoTipo(e.target.value as VinculoTipo | '')
                  setVinculoId('')
                }}
              >
                <option value="">Nenhum</option>
                {VINCULO_TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            {vinculoTipo && (
              <div className="field">
                <label>Documento</label>
                <select value={vinculoId} onChange={(e) => setVinculoId(e.target.value)}>
                  <option value="">
                    {vinculoOptions.isLoading ? 'Carregando...' : 'Selecione...'}
                  </option>
                  {vinculoOptions.data?.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.title}
                      {opt.sub ? ` (${opt.sub})` : ''}
                    </option>
                  ))}
                </select>
                {vinculoOptions.data?.length === 0 && !vinculoOptions.isLoading && (
                  <span className="field-hint">
                    Nenhum {vinculoTipo === 'POP' ? 'POP' : vinculoTipo.toLowerCase()} disponível em {setor} ainda — o
                    módulo correspondente ainda não tem tela própria nesta app.
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="field-row">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={fotoObrigatoria}
                disabled={envolveProducao}
                onChange={(e) => setFotoObrigatoria(e.target.checked)}
              />
              Foto obrigatória ao concluir
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              Ativa
            </label>
          </div>

          <div>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={envolveProducao}
                onChange={(e) => {
                  setEnvolveProducao(e.target.checked)
                  if (e.target.checked) setFotoObrigatoria(false)
                  else setProducaoVinculadaId('')
                }}
              />
              Esta tarefa envolve produção (gera lote + entrada automática no Estoque ao concluir)
            </label>
            {envolveProducao && (
              <div className="field" style={{ marginTop: 8 }}>
                <select value={producaoVinculadaId} onChange={(e) => setProducaoVinculadaId(e.target.value)}>
                  <option value="">Selecione a ficha de produção...</option>
                  {producoesDoSetor?.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome}
                    </option>
                  ))}
                </select>
                {producoesDoSetor?.length === 0 && (
                  <span className="field-hint">Nenhuma ficha de produção publicada em {setor} ainda.</span>
                )}
              </div>
            )}
          </div>

          {error && <p className="login-error">{error}</p>}

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={!isValid || submitting}>
              {submitting ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar tarefa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
