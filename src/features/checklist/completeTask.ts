import { supabase } from '../../lib/supabaseClient'
import type { ChecklistTaskRow, EstoqueUnidade } from '../../types/database'

export interface JustificativaAtraso {
  texto: string
  missedDate: string
  daysLate: number
}

export interface Antecipacao {
  justificativa: string
}

export interface ProducaoRegistro {
  quantidade: number
  unidade: EstoqueUnidade
}

export interface CompleteTaskOptions {
  photoFile?: File
  justificativaAtraso?: JustificativaAtraso
  antecipacao?: Antecipacao
  producao?: ProducaoRegistro
}

export interface CompleteTaskResult {
  loteId: string | null
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
): Promise<CompleteTaskResult> {
  let fotoUrl: string | null = null

  if (options.photoFile) {
    const path = `${task.setor}/${task.id}/${Date.now()}-${options.photoFile.name}`
    const { error: uploadError } = await supabase.storage.from('checklist-fotos').upload(path, options.photoFile)
    if (uploadError) throw uploadError
    fotoUrl = path
  }

  // "Envolve produção" e foto obrigatória são mutuamente exclusivos (ver
  // ManageChecklistModal) — quando a tarefa envolve produção, registrar_
  // producao_checklist gera o lote + dá entrada no Estoque, e os ids voltam
  // pra anexar na conclusão (usados depois pra reverter, se desmarcada, e
  // pra imprimir a etiqueta).
  let loteId: string | null = null
  let movimentoEstoqueId: string | null = null
  if (task.envolve_producao && task.producao_vinculada_id && options.producao) {
    const { data, error: rpcError } = await supabase.rpc('registrar_producao_checklist', {
      p_producao_id: task.producao_vinculada_id,
      p_quantidade: options.producao.quantidade,
      p_unidade: options.producao.unidade,
    })
    if (rpcError) throw rpcError
    loteId = data[0].lote_id
    movimentoEstoqueId = data[0].movimento_id
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
    lote_id: loteId,
    movimento_estoque_id: movimentoEstoqueId,
  })
  if (error) throw error

  return { loteId }
}

// A ordem importa: lote_id/movimento_estoque_id em checklist_conclusoes têm
// FK (sem cascade) pra fichas_producao_lotes/estoque_movimentos — apagar a
// conclusão primeiro libera essas linhas pra reverter_producao_checklist
// poder de fato deletá-las (ela roda DEPOIS, nunca antes).
export async function uncompleteTask(taskId: number, dataReferencia: string) {
  const { data: deleted, error } = await supabase
    .from('checklist_conclusoes')
    .delete()
    .eq('task_id', taskId)
    .eq('data_referencia', dataReferencia)
    .select('lote_id, movimento_estoque_id')
    .maybeSingle()
  if (error) throw error

  if (deleted?.lote_id && deleted?.movimento_estoque_id) {
    const { error: rpcError } = await supabase.rpc('reverter_producao_checklist', {
      p_lote_id: deleted.lote_id,
      p_movimento_id: deleted.movimento_estoque_id,
    })
    if (rpcError) throw rpcError
  }
}

// checklist-fotos é um bucket PRIVADO (RLS por setor) — getPublicUrl não
// funciona aqui (esse endpoint só serve bucket público, ignorando RLS).
// Precisa de uma signed URL de curta duração, gerada sob demanda.
export async function checklistFotoUrl(path: string) {
  const { data, error } = await supabase.storage.from('checklist-fotos').createSignedUrl(path, 300)
  if (error) throw error
  return data.signedUrl
}

// "Apagar notificação de atraso" — Administrador zera de vez, Gestor de
// setor só esconde da própria visão. A diferença é decidida no servidor
// (migration 0015, resolve_justificativa_atraso) porque depende do papel de
// quem chama, não de algo que o client deva decidir.
export async function resolveJustificativaAtraso(conclusaoId: string) {
  const { error } = await supabase.rpc('resolve_justificativa_atraso', { p_conclusao_id: conclusaoId })
  if (error) throw error
}
