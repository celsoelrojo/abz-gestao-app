import { supabase } from '../../lib/supabaseClient'
import type { ChecklistTaskRow } from '../../types/database'

export interface JustificativaAtraso {
  texto: string
  missedDate: string
  daysLate: number
}

export interface Antecipacao {
  justificativa: string
}

export interface CompleteTaskOptions {
  photoFile?: File
  justificativaAtraso?: JustificativaAtraso
  antecipacao?: Antecipacao
}

// Concluir = inserir 1 linha em checklist_conclusoes (a RLS já garante que só
// dá pra fazer isso pra tarefa do próprio setor). "Desmarcar" = apagar essa
// linha — como cada linha é uma conclusão específica, apagar já limpa foto e
// justificativas juntas, sem precisar zerar campo por campo (diferente do
// protótipo, que tinha um objeto único por tarefa). Foto vai pro bucket
// checklist-fotos ANTES do insert, seguindo a convenção de path
// `<setor>/<task_id>/<timestamp>-<nome>` que a policy de Storage espera.
export async function completeTask(
  task: ChecklistTaskRow,
  dataReferencia: string,
  userId: string,
  options: CompleteTaskOptions = {},
) {
  let fotoUrl: string | null = null

  if (options.photoFile) {
    const path = `${task.setor}/${task.id}/${Date.now()}-${options.photoFile.name}`
    const { error: uploadError } = await supabase.storage.from('checklist-fotos').upload(path, options.photoFile)
    if (uploadError) throw uploadError
    fotoUrl = path
  }

  const { error } = await supabase.from('checklist_conclusoes').insert({
    task_id: task.id,
    data_referencia: dataReferencia,
    completed_by: userId,
    foto_url: fotoUrl,
    justificativa_atraso: options.justificativaAtraso?.texto ?? null,
    justificativa_atraso_missed_date: options.justificativaAtraso?.missedDate ?? null,
    justificativa_atraso_days_late: options.justificativaAtraso?.daysLate ?? null,
    // A "data programada" da antecipação é a própria data_referencia (a
    // ocorrência futura que está sendo concluída antes da hora) — guardada
    // de novo aqui só porque a coluna já existia na migration original.
    antecipacao_data_programada: options.antecipacao ? dataReferencia : null,
    antecipacao_justificativa: options.antecipacao?.justificativa ?? null,
  })
  if (error) throw error
}

export async function uncompleteTask(taskId: number, dataReferencia: string) {
  const { error } = await supabase
    .from('checklist_conclusoes')
    .delete()
    .eq('task_id', taskId)
    .eq('data_referencia', dataReferencia)
  if (error) throw error
}

export function checklistFotoUrl(path: string) {
  return supabase.storage.from('checklist-fotos').getPublicUrl(path).data.publicUrl
}

// "Apagar notificação de atraso" — Administrador zera de vez, Gestor de
// setor só esconde da própria visão. A diferença é decidida no servidor
// (migration 0015, resolve_justificativa_atraso) porque depende do papel de
// quem chama, não de algo que o client deva decidir.
export async function resolveJustificativaAtraso(conclusaoId: string) {
  const { error } = await supabase.rpc('resolve_justificativa_atraso', { p_conclusao_id: conclusaoId })
  if (error) throw error
}
