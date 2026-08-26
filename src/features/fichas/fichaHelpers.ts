import type { FichaIngredienteTecnica, UnidadeValidade } from '../../types/database'

// Espelha calcIngredienteCustoUnitario/calcIngredienteCustoTotal/
// calcFichaCustos do protótipo (script.js:7635-7657) — o custo NUNCA é
// digitado direto, é sempre derivado de qtdBase/precoBase, e o custo total
// usa qtdBruta (o que se compra), nunca qtdLiquida (o que sobra depois da
// perda) — qtdLiquida/fatorCorrecao são só informativos, sem fórmula
// nenhuma ligando os três campos (confirmado no protótipo: são 3 inputs
// manuais independentes, sem recálculo automático entre eles).
export function calcIngredienteCustoUnitario(ing: Pick<FichaIngredienteTecnica, 'qtdBase' | 'precoBase'>): number {
  const qtdBase = Number(ing.qtdBase) || 0
  const precoBase = Number(ing.precoBase) || 0
  return qtdBase > 0 ? precoBase / qtdBase : 0
}

export function calcIngredienteCustoTotal(
  ing: Pick<FichaIngredienteTecnica, 'qtdBase' | 'precoBase' | 'qtdBruta'>,
): number {
  return calcIngredienteCustoUnitario(ing) * (Number(ing.qtdBruta) || 0)
}

export interface FichaCustos {
  custoTotalReceita: number
  lucroBruto: number | null
  margemEstimada: number | null
}

export function calcFichaCustos(
  ingredientes: Pick<FichaIngredienteTecnica, 'qtdBase' | 'precoBase' | 'qtdBruta'>[],
  embalagem: number | null,
  precoSugerido: number | null,
): FichaCustos {
  const custoIngredientes = ingredientes.reduce((sum, ing) => sum + calcIngredienteCustoTotal(ing), 0)
  const extras = Number(embalagem) || 0
  const custoTotalReceita = custoIngredientes + extras
  const preco = Number(precoSugerido) || 0
  const lucroBruto = preco > 0 ? preco - custoTotalReceita : null
  const margemEstimada = preco > 0 ? ((preco - custoTotalReceita) / preco) * 100 : null
  return { custoTotalReceita, lucroBruto, margemEstimada }
}

// Espelha calcValidadeDateTime do protótipo (script.js:7664-7681) —
// condicaoArmazenamento NUNCA entra na conta, é só texto descritivo exibido
// ao lado; Meses usa setMonth (herda o "estouro" de calendário do JS, ex.:
// 31/jan + 1 mês vira 03/mar, não 28/29/fev).
export function calcValidadeDateTime(
  dataHoraProducao: string | Date | null,
  prazo: number | null,
  unidade: UnidadeValidade | null,
): Date | null {
  if (!dataHoraProducao || !prazo || !unidade) return null
  const base = new Date(dataHoraProducao)
  if (isNaN(base.getTime())) return null
  const qty = Number(prazo)
  if (!qty) return null
  if (unidade === 'Horas') base.setHours(base.getHours() + qty)
  else if (unidade === 'Dias') base.setDate(base.getDate() + qty)
  else if (unidade === 'Semanas') base.setDate(base.getDate() + qty * 7)
  else if (unidade === 'Meses') base.setMonth(base.getMonth() + qty)
  else return null
  return base
}

// Espelha updateProducaoCalculator (script.js:9021-9058) — só leitura,
// nunca reescreve a receita salva. ratio = quantidade digitada / quantidade
// padrão do ingrediente Base; todo o resto escala proporcionalmente.
export interface CalculadoraResultado {
  ratio: number
  quantidades: Record<string, number> // ingredienteId -> quantidade calculada
  rendimentoAjustado: number
}

export function calcularProducaoEscalada(
  ingredientes: { id: string; qtdLotePadrao: number | null }[],
  baseIngredienteId: string,
  quantidadeDigitada: number,
  qtdPorcoesUnidades: number | null,
): CalculadoraResultado | null {
  const base = ingredientes.find((i) => i.id === baseIngredienteId)
  const baseQtdPadrao = Number(base?.qtdLotePadrao) || 0
  if (!base || baseQtdPadrao <= 0 || !(quantidadeDigitada > 0)) return null

  const ratio = quantidadeDigitada / baseQtdPadrao
  const quantidades: Record<string, number> = {}
  ingredientes
    .filter((i) => i.id !== baseIngredienteId)
    .forEach((i) => {
      quantidades[i.id] = (Number(i.qtdLotePadrao) || 0) * ratio
    })
  return {
    ratio,
    quantidades,
    rendimentoAjustado: (Number(qtdPorcoesUnidades) || 0) * ratio,
  }
}

// Espelha gerarNumeroLote do protótipo: prefixo do código (ou 3 primeiras
// letras do nome, só [A-Z0-9]) + DDMM + sequencial de 3 dígitos.
export function gerarNumeroLote(nome: string, codigo: string | null, dataProducao: Date, sequencial: number): string {
  const base = (codigo?.trim() || nome.slice(0, 3)).toUpperCase().replace(/[^A-Z0-9]/g, '')
  const prefixo = base || 'LOTE'
  const dd = String(dataProducao.getDate()).padStart(2, '0')
  const mm = String(dataProducao.getMonth() + 1).padStart(2, '0')
  return `${prefixo}-${dd}${mm}-${String(sequencial).padStart(3, '0')}`
}
