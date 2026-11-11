// Regras do Checklist e textos dos avisos do Telegram, em TypeScript puro (sem
// dependências) pra rodar na Edge Function (Deno) e ser testado pelo vitest.
//
// A agenda ESPELHA src/features/checklist/scheduling.ts (isTaskScheduledOn):
// uma função de fora de supabase/functions não entra no deploy, então a regra
// é copiada aqui. src/features/checklist/agendaParidade.test.ts compara as
// duas — se mudar uma, o teste obriga a mudar a outra.

export interface TarefaAgenda {
  active: boolean
  periodicidade: string
  dias: string[]
  data_unica: string | null
  semanas_do_mes: string[]
}

const DIAS_DA_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

// "YYYY-MM-DD" -> partes numéricas, sem passar por Date local (a função roda em UTC).
function partes(iso: string): { ano: number; mes: number; dia: number } {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return { ano, mes, dia }
}

function diaDaSemana(iso: string): number {
  const { ano, mes, dia } = partes(iso)
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()
}

function diasNoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate()
}

export function somarDiasIso(iso: string, n: number): string {
  const { ano, mes, dia } = partes(iso)
  return new Date(Date.UTC(ano, mes - 1, dia + n)).toISOString().slice(0, 10)
}

function bateComSemanaDoMes(task: TarefaAgenda, iso: string): boolean {
  if (!task.semanas_do_mes.length) return true
  const { ano, mes, dia } = partes(iso)
  if (task.semanas_do_mes.includes(String(Math.ceil(dia / 7)))) return true
  // "Última" = a última ocorrência daquele dia da semana no mês.
  return task.semanas_do_mes.includes('ultima') && dia + 7 > diasNoMes(ano, mes)
}

export function tarefaAgendadaEm(task: TarefaAgenda, iso: string): boolean {
  if (!task.active) return false
  if (task.periodicidade === 'Única') return task.data_unica === iso
  if (!task.dias.includes(DIAS_DA_SEMANA[diaDaSemana(iso)])) return false
  if (task.periodicidade === 'Mensal' || task.periodicidade === 'Quinzenal') return bateComSemanaDoMes(task, iso)
  return true
}

// Data (YYYY-MM-DD) em Brasília (UTC-3, sem horário de verão) de um instante.
export function dataEmBrasilia(instante: Date | string): string {
  return new Date(new Date(instante).getTime() - 3 * 3600_000).toISOString().slice(0, 10)
}

// O dia do bar vai das 5h às 5h: este é o dia operacional de `agora`.
export function diaOperacionalIso(agora: Date): string {
  return new Date(agora.getTime() - 3 * 3600_000 - 5 * 3600_000).toISOString().slice(0, 10)
}

export interface TarefaDoDia extends TarefaAgenda {
  id: number
  title: string
  setor: string
  created_at: string
}

// Tarefas que deviam ter sido feitas em `dataIso` e não têm conclusão nesse dia.
// Tarefa criada depois da data não conta (não existia).
export function pendentesDoDia(tarefas: TarefaDoDia[], concluidasIds: Set<number>, dataIso: string): TarefaDoDia[] {
  return tarefas.filter((t) => dataEmBrasilia(t.created_at) <= dataIso && tarefaAgendadaEm(t, dataIso) && !concluidasIds.has(t.id))
}

export function esc(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function dataCurta(iso: string): string {
  const { mes, dia } = partes(iso)
  return `${DIAS_CURTOS[diaDaSemana(iso)]} ${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`
}

function hora(instante: string): string {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(instante))
}

// Telegram (HTML): aviso de tarefa concluída.
export function mensagemConclusao(d: { titulo: string; setor: string; por: string | null; concluidaEm: string; diasAtraso: number | null; comFoto: boolean }): string {
  const linhas = [`✅ <b>${esc(d.titulo)}</b>`, `${esc(d.setor)} · ${d.por ? `por ${esc(d.por)} ` : ''}às ${hora(d.concluidaEm)}`]
  if (d.diasAtraso && d.diasAtraso > 0) linhas.push(`⚠️ Feita com ${d.diasAtraso} ${d.diasAtraso === 1 ? 'dia' : 'dias'} de atraso`)
  if (d.comFoto) linhas.push('📷 Com foto')
  return linhas.join('\n')
}

const LIMITE_LISTA = 40

// Telegram (HTML): resumo do dia que acabou de fechar, por setor.
export function mensagemPendencias(dataIso: string, agendadasPorSetor: Record<string, number>, pendentes: { title: string; setor: string }[]): string {
  const total = Object.values(agendadasPorSetor).reduce((s, n) => s + n, 0)
  if (total === 0) return `📋 <b>${dataCurta(dataIso)}</b>\nNão havia tarefas programadas nesse dia.`
  if (pendentes.length === 0) return `✅ <b>${dataCurta(dataIso)}</b>\nTudo em dia: ${total} de ${total} tarefas feitas.`

  const linhas = [`📋 <b>Pendências de ${dataCurta(dataIso)}</b>`, `${pendentes.length} de ${total} tarefas não foram feitas.`]
  let usadas = 0
  for (const setor of Object.keys(agendadasPorSetor).sort()) {
    const doSetor = pendentes.filter((p) => p.setor === setor)
    if (doSetor.length === 0) continue
    linhas.push('', `<b>${esc(setor)}</b> — ${doSetor.length} de ${agendadasPorSetor[setor]}`)
    for (const p of doSetor) {
      if (usadas >= LIMITE_LISTA) break
      linhas.push(`• ${esc(p.title)}`)
      usadas++
    }
  }
  if (pendentes.length > usadas) linhas.push('', `… e mais ${pendentes.length - usadas}`)
  return linhas.join('\n')
}
