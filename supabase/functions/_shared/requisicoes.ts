// Textos dos avisos de Requisição no Telegram, em TypeScript puro (sem
// dependências) pra rodar na Edge Function (Deno) e ser testado pelo vitest.
import { dataEmBrasilia, esc } from './agenda.ts'

export interface RequisicaoAviso {
  tipo: string
  titulo: string
  descricao: string | null
  urgencia: string
  status: string
  solicitante_nome: string
  setor: string | null
  foto_path: string | null
  created_at: string
}

const TIPOS: Record<string, string> = { compra: 'Compra', conserto: 'Conserto' }
const URGENCIAS: Record<string, string> = { alta: '🔴 Alta', media: '🟡 Média', baixa: '🟢 Baixa' }
const BOLINHAS: Record<string, string> = { alta: '🔴', media: '🟡', baixa: '🟢' }
const PESO_URGENCIA: Record<string, number> = { alta: 0, media: 1, baixa: 2 }
// O Telegram recusa mensagem com mais de 4096 caracteres.
export const LIMITE_MENSAGEM = 3500

function cortar(texto: string, max: number): string {
  const limpo = texto.replace(/\s+/g, ' ').trim()
  return limpo.length > max ? `${limpo.slice(0, max - 1)}…` : limpo
}

function autor(r: RequisicaoAviso): string {
  const nome = r.solicitante_nome || 'sem nome'
  return r.setor ? `${nome} (${r.setor})` : nome
}

export function mensagemNovaRequisicao(r: RequisicaoAviso): string {
  const linhas = [
    `🆕 <b>Nova requisição — ${TIPOS[r.tipo] ?? esc(r.tipo)}</b>`,
    `<b>${esc(cortar(r.titulo, 200))}</b>`,
    `Urgência: ${URGENCIAS[r.urgencia] ?? esc(r.urgencia)}`,
    `Pedida por ${esc(autor(r))}`,
  ]
  if (r.descricao?.trim()) linhas.push('', esc(cortar(r.descricao, 500)))
  if (r.foto_path) linhas.push('📷 Com foto (veja no app)')
  return linhas.join('\n')
}

function idade(criadaEm: string, agora: Date): string {
  const dias = Math.round((Date.parse(dataEmBrasilia(agora)) - Date.parse(dataEmBrasilia(criadaEm))) / 86_400_000)
  if (dias <= 0) return 'hoje'
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`
}

// Lista de tudo que ainda não foi feito (pendente ou aprovada). Devolve uma ou
// mais mensagens: nenhuma requisição fica de fora por causa do limite do Telegram.
export function mensagensRequisicoesAbertas(requisicoes: RequisicaoAviso[], agora: Date = new Date()): string[] {
  const abertas = requisicoes.filter((r) => r.status === 'pendente' || r.status === 'aprovada')
  if (abertas.length === 0) return ['✅ <b>Requisições</b>\nNenhuma requisição em aberto.']

  const total = abertas.length === 1 ? '1 requisição ainda não foi feita.' : `${abertas.length} requisições ainda não foram feitas.`
  const linhas = ['🧾 <b>Requisições em aberto</b>', total]
  const grupos = [
    { status: 'pendente', titulo: 'Aguardando decisão' },
    { status: 'aprovada', titulo: 'Aprovadas, ainda não concluídas' },
  ]
  for (const g of grupos) {
    const doGrupo = abertas
      .filter((r) => r.status === g.status)
      .sort((a, b) => (PESO_URGENCIA[a.urgencia] ?? 9) - (PESO_URGENCIA[b.urgencia] ?? 9) || a.created_at.localeCompare(b.created_at))
    if (doGrupo.length === 0) continue
    linhas.push('', `<b>${g.titulo}</b> (${doGrupo.length})`)
    for (const r of doGrupo) {
      linhas.push(`${BOLINHAS[r.urgencia] ?? '•'} ${TIPOS[r.tipo] ?? esc(r.tipo)}: ${esc(cortar(r.titulo, 150))} — ${esc(autor(r))}, ${idade(r.created_at, agora)}`)
    }
  }

  const mensagens: string[] = []
  let atual = ''
  for (const linha of linhas) {
    if (atual && atual.length + linha.length + 1 > LIMITE_MENSAGEM) {
      mensagens.push(atual.trimEnd())
      atual = linha
    } else {
      atual = atual ? `${atual}\n${linha}` : linha
    }
  }
  if (atual) mensagens.push(atual.trimEnd())
  return mensagens
}
