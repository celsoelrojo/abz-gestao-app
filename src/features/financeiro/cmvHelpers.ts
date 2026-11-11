import { HORA_VIRADA_DIA } from '../../lib/date'
import { somarDias } from './contaHelpers'
import type { ContaPagarRow, EstoqueItemRow, FaturamentoDiaRow } from '../../types/database'

// CMV = estoque inicial + compras − estoque final;  CMV % = CMV ÷ faturamento.
// Tudo aqui é puro (sem rede) pra poder ser testado; as telas só buscam os dados.

// Período em datas ISO, as duas pontas incluídas.
export interface Periodo {
  inicio: string
  fim: string
}

export type PeriodoPreset = 'semana' | 'semana-passada' | 'mes' | 'mes-passado'

export const PERIODO_PRESET_LABELS: Record<PeriodoPreset, string> = {
  semana: 'Esta semana',
  'semana-passada': 'Semana passada',
  mes: 'Este mês',
  'mes-passado': 'Mês passado',
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Segunda a domingo da semana que contém `hojeIso`.
export function semanaDe(hojeIso: string): Periodo {
  const d = new Date(`${hojeIso}T00:00:00`)
  const desdeSegunda = (d.getDay() + 6) % 7
  const inicio = somarDias(hojeIso, -desdeSegunda)
  return { inicio, fim: somarDias(inicio, 6) }
}

export function mesDe(hojeIso: string, deslocamento = 0): Periodo {
  const [ano, mes] = hojeIso.split('-').map(Number)
  const primeiro = new Date(ano, mes - 1 + deslocamento, 1)
  const ultimo = new Date(primeiro.getFullYear(), primeiro.getMonth() + 1, 0)
  return { inicio: iso(primeiro), fim: iso(ultimo) }
}

export function periodoDoPreset(preset: PeriodoPreset, hojeIso: string): Periodo {
  switch (preset) {
    case 'semana':
      return semanaDe(hojeIso)
    case 'semana-passada':
      return semanaDe(somarDias(hojeIso, -7))
    case 'mes':
      return mesDe(hojeIso)
    case 'mes-passado':
      return mesDe(hojeIso, -1)
  }
}

export function listarDias(periodo: Periodo): string[] {
  const dias: string[] = []
  for (let d = periodo.inicio; d <= periodo.fim; d = somarDias(d, 1)) dias.push(d)
  return dias
}

// O dia operacional vai das 05:00 às 05:00 (ver lib/date). O estoque inicial é
// o saldo na virada que abre o período; o final, o saldo na virada que o fecha
// (a contagem de fechamento, feita de madrugada, ainda é do último dia).
// O Brasil não tem horário de verão desde 2019: o fuso é fixo, -03:00.
const virada = (dia: string) => `${dia}T${String(HORA_VIRADA_DIA).padStart(2, '0')}:00:00-03:00`
export const momentoInicial = (p: Periodo) => virada(p.inicio)
export const momentoFinal = (p: Periodo) => virada(somarDias(p.fim, 1))

// ---------------- estoque valorizado ----------------

export type ItemEstoqueCmv = Pick<EstoqueItemRow, 'id' | 'title' | 'unidade' | 'categoria' | 'tipo_produto'>

// Material de limpeza e "Outros" não são mercadoria; Remanufaturado (xaropes,
// preparos) é feito de insumos que já estão no estoque — contar os dois seria
// contar o mesmo custo duas vezes.
export function itemContaNoCmv(item: Pick<EstoqueItemRow, 'categoria' | 'tipo_produto'>): boolean {
  return item.tipo_produto !== 'Remanufaturado' && item.categoria !== 'Material de Limpeza' && item.categoria !== 'Outros'
}

export interface LinhaEstoque {
  itemId: string
  titulo: string
  unidade: string
  quantidade: number
  custo: number | null
  valor: number
}

export interface EstoqueValorizado {
  total: number
  linhas: LinhaEstoque[]
  // Itens com saldo mas sem custo definido: ficam de fora do total.
  semCusto: LinhaEstoque[]
}

const arredondar = (n: number) => Math.round(n * 100) / 100

export function valorizarEstoque(
  itens: ItemEstoqueCmv[],
  saldos: Map<string, number>,
  custos: Map<string, number>,
): EstoqueValorizado {
  const linhas: LinhaEstoque[] = []
  const semCusto: LinhaEstoque[] = []
  for (const item of itens) {
    if (!itemContaNoCmv(item)) continue
    // Saldo reconstruído pode sair levemente negativo se o histórico tiver furo.
    const quantidade = Math.max(0, saldos.get(item.id) ?? 0)
    if (quantidade <= 0) continue
    const custo = custos.get(item.id) ?? null
    const linha: LinhaEstoque = {
      itemId: item.id,
      titulo: item.title,
      unidade: item.unidade,
      quantidade,
      custo,
      valor: custo == null ? 0 : arredondar(quantidade * custo),
    }
    if (custo == null) semCusto.push(linha)
    else linhas.push(linha)
  }
  linhas.sort((a, b) => b.valor - a.valor)
  semCusto.sort((a, b) => a.titulo.localeCompare(b.titulo))
  return { total: arredondar(linhas.reduce((s, l) => s + l.valor, 0)), linhas, semCusto }
}

// ---------------- compras ----------------

export const ehMercadoria = (categoria: string) => categoria.startsWith('Mercadoria')

// Competência da compra: a data da nota; sem ela, o vencimento.
export const dataDaCompra = (c: Pick<ContaPagarRow, 'data_compra' | 'vencimento'>) => c.data_compra ?? c.vencimento

export interface ComprasPeriodo {
  total: number
  porCategoria: { categoria: string; total: number; quantidade: number }[]
  contas: ContaPagarRow[]
}

export function somarCompras(contas: ContaPagarRow[], periodo: Periodo): ComprasPeriodo {
  const doPeriodo = contas
    .filter((c) => ehMercadoria(c.categoria))
    .filter((c) => {
      const d = dataDaCompra(c)
      return d >= periodo.inicio && d <= periodo.fim
    })
    .sort((a, b) => dataDaCompra(a).localeCompare(dataDaCompra(b)))
  const grupos = new Map<string, { total: number; quantidade: number }>()
  for (const c of doPeriodo) {
    const g = grupos.get(c.categoria) ?? { total: 0, quantidade: 0 }
    g.total += c.valor
    g.quantidade += 1
    grupos.set(c.categoria, g)
  }
  return {
    total: arredondar(doPeriodo.reduce((s, c) => s + c.valor, 0)),
    porCategoria: [...grupos.entries()]
      .map(([categoria, g]) => ({ categoria, total: arredondar(g.total), quantidade: g.quantidade }))
      .sort((a, b) => b.total - a.total),
    contas: doPeriodo,
  }
}

// ---------------- faturamento ----------------

export interface FaturamentoPeriodo {
  total: number
  diasLancados: number
  // Dias do período (até hoje) sem valor lançado. Dia fechado = lançar 0.
  diasSemLancamento: string[]
}

export function somarFaturamento(dias: Pick<FaturamentoDiaRow, 'data' | 'valor'>[], periodo: Periodo, hojeIso: string): FaturamentoPeriodo {
  const porDia = new Map(dias.map((d) => [d.data, d.valor]))
  const diasDoPeriodo = listarDias(periodo)
  const lancados = diasDoPeriodo.filter((d) => porDia.has(d))
  return {
    total: arredondar(lancados.reduce((s, d) => s + (porDia.get(d) ?? 0), 0)),
    diasLancados: lancados.length,
    diasSemLancamento: diasDoPeriodo.filter((d) => d <= hojeIso && !porDia.has(d)),
  }
}

// ---------------- resultado ----------------

export interface ResultadoCmv {
  cmv: number
  // null quando não há faturamento no período (não dá pra dividir).
  percentual: number | null
}

export function calcularCmv(p: { estoqueInicial: number; compras: number; estoqueFinal: number; faturamento: number }): ResultadoCmv {
  const cmv = arredondar(p.estoqueInicial + p.compras - p.estoqueFinal)
  return { cmv, percentual: p.faturamento > 0 ? (cmv / p.faturamento) * 100 : null }
}

export function formatPercent(valor: number): string {
  return `${valor.toFixed(1).replace('.', ',')}%`
}

// Custo por unidade: R$ com 2 a 4 casas ("R$ 0,0312", "R$ 120,00").
export function formatCusto(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

// Quantidade com até 3 casas, sem zeros sobrando ("12,5", "4").
export function formatQuantidade(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}
