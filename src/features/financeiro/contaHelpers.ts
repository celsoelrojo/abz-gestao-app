import type { ContaPagarRow } from '../../types/database'

export type ContaSituacao = 'paga' | 'vencida' | 'vence_hoje' | 'a_vencer'

export const CONTA_SITUACAO_LABELS: Record<ContaSituacao, string> = {
  paga: 'Paga',
  vencida: 'Vencida',
  vence_hoje: 'Vence hoje',
  a_vencer: 'A vencer',
}

export const CONTA_SITUACAO_BADGE_CLASS: Record<ContaSituacao, string> = {
  paga: 'badge-status-ativa',
  vencida: 'badge-status-bloqueada',
  vence_hoje: 'badge-status-pendente',
  a_vencer: 'badge-status-pendente',
}

// `hoje` é a data local em ISO (YYYY-MM-DD) — comparação de string funciona
// porque o formato é ordenável.
export function situacaoConta(conta: Pick<ContaPagarRow, 'pago_em' | 'vencimento'>, hoje: string): ContaSituacao {
  if (conta.pago_em) return 'paga'
  if (conta.vencimento < hoje) return 'vencida'
  if (conta.vencimento === hoje) return 'vence_hoje'
  return 'a_vencer'
}

// "1.234,56" / "1234,56" / "1234.56" / "R$ 50" -> número; inválido -> null.
// Vírgula é o decimal quando presente (e então os pontos são milhar); sem
// vírgula, um único ponto com 1–2 dígitos depois é decimal ("12.5"), qualquer
// outro uso do ponto é milhar ("1.234").
export function parseValorBR(texto: string): number | null {
  const limpo = texto.replace(/[^\d.,]/g, '')
  if (!limpo) return null
  let numero: string
  if (limpo.includes(',')) {
    numero = limpo.replace(/\./g, '').replace(',', '.')
  } else if (/^\d+\.\d{1,2}$/.test(limpo)) {
    numero = limpo
  } else {
    numero = limpo.replace(/\./g, '')
  }
  const n = Number(numero)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

export function formatBRL(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Soma `meses` meses a uma data ISO mantendo o dia; se o mês de destino é mais
// curto (31/01 + 1 mês), cai no último dia dele (28 ou 29/02).
export function somarMeses(iso: string, meses: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  const alvo = new Date(a, m - 1 + meses, 1)
  const ultimo = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate()
  const dia = Math.min(d, ultimo)
  const mm = String(alvo.getMonth() + 1).padStart(2, '0')
  return `${alvo.getFullYear()}-${mm}-${String(dia).padStart(2, '0')}`
}

// Vencimentos de uma conta que se repete todo mês: o 1º é o informado, os
// seguintes mantêm o mesmo dia (sempre calculados a partir do 1º, pra um 31
// que caiu em 28 voltar a 31 no mês seguinte).
export function gerarVencimentos(primeiro: string, quantidade: number): string[] {
  return Array.from({ length: quantidade }, (_, i) => somarMeses(primeiro, i))
}

export function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  const dt = new Date(a, m - 1, d + dias)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export interface ResumoContas {
  emAberto: { total: number; quantidade: number }
  vencidas: { total: number; quantidade: number }
  proximos7: { total: number; quantidade: number }
  pagoNoMes: { total: number; quantidade: number }
}

// Painel do topo. `hoje` ISO; "próximos 7 dias" = de hoje até hoje+7 (inclusive)
// ainda em aberto; "pago no mês" = pagamentos feitos no mês de `hoje` (por data
// do pagamento, não do vencimento).
export function resumirContas(contas: ContaPagarRow[], hoje: string): ResumoContas {
  const limite = somarDias(hoje, 7)
  const mes = hoje.slice(0, 7)
  const r: ResumoContas = {
    emAberto: { total: 0, quantidade: 0 },
    vencidas: { total: 0, quantidade: 0 },
    proximos7: { total: 0, quantidade: 0 },
    pagoNoMes: { total: 0, quantidade: 0 },
  }
  for (const c of contas) {
    if (c.pago_em) {
      if (c.pago_em.startsWith(mes)) {
        r.pagoNoMes.total += c.valor_pago ?? c.valor
        r.pagoNoMes.quantidade += 1
      }
      continue
    }
    r.emAberto.total += c.valor
    r.emAberto.quantidade += 1
    if (c.vencimento < hoje) {
      r.vencidas.total += c.valor
      r.vencidas.quantidade += 1
    } else if (c.vencimento <= limite) {
      r.proximos7.total += c.valor
      r.proximos7.quantidade += 1
    }
  }
  for (const k of Object.keys(r) as (keyof ResumoContas)[]) r[k].total = Math.round(r[k].total * 100) / 100
  return r
}

// Em aberto: vencimento mais antigo primeiro (o mais urgente paga antes).
export function ordenarEmAberto(contas: ContaPagarRow[]): ContaPagarRow[] {
  return [...contas].sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.created_at.localeCompare(b.created_at))
}

// Pagas: pagamento mais recente primeiro.
export function ordenarPagas(contas: ContaPagarRow[]): ContaPagarRow[] {
  return [...contas].sort((a, b) => (b.pago_em ?? '').localeCompare(a.pago_em ?? '') || b.vencimento.localeCompare(a.vencimento))
}

export function contaFormError(input: {
  descricao: string
  valor: number | null
  vencimento: string
  repeticoes: number
}): string | null {
  if (!input.descricao.trim()) return 'Informe a descrição da conta.'
  if (input.valor == null || input.valor <= 0) return 'Informe um valor maior que zero (ex.: 1.234,56).'
  if (!input.vencimento) return 'Informe o vencimento.'
  if (!Number.isInteger(input.repeticoes) || input.repeticoes < 1 || input.repeticoes > 60) {
    return 'A repetição deve ser de 1 a 60 meses.'
  }
  return null
}
