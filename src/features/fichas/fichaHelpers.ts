import type { FichaIngredienteTecnica, ProducaoIngrediente, UnidadeValidade } from '../../types/database'

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

// Custo do ingrediente = quantidade × custo unitário do produto do estoque
// vinculado (o custo unitário já é "por unidade do produto", kg/L/un — ver
// EstoqueCadastrarProdutoTab/estoque_itens.unidade). Percentual de perda é só
// informativo, igual qtdLiquida/fatorCorrecao em Fichas Técnicas — nenhuma
// fórmula de custo usa perda, pra nunca confundir de onde um número veio.
export function calcProducaoIngredienteCustoTotal(ing: Pick<ProducaoIngrediente, 'quantidade' | 'custoUnitario'>): number {
  return (Number(ing.quantidade) || 0) * (Number(ing.custoUnitario) || 0)
}

export function calcProducaoFichaCustoTotal(ingredientes: Pick<ProducaoIngrediente, 'quantidade' | 'custoUnitario'>[]): number {
  return ingredientes.reduce((sum, ing) => sum + calcProducaoIngredienteCustoTotal(ing), 0)
}

// Escala a receita pelo Rendimento (qtd_lote_padrao) — ratio = rendimento
// desejado / rendimento padrão da ficha, aplicado a todos os ingredientes.
// Substitui a versão antiga baseada em escolher um ingrediente "Base"
// (removida junto com o campo tipo, que não fazia parte do pedido do
// usuário pro novo formulário) — o Rendimento já é o número que a ficha
// declara pra "quanto essa receita rende", então é a base natural pra
// escalar tudo o resto.
export interface CalculadoraResultado {
  ratio: number
  quantidades: Record<string, number> // ingredienteId -> quantidade calculada
}

export function calcularProducaoEscalada(
  ingredientes: { id: string; quantidade: number | null }[],
  rendimentoPadrao: number | null,
  rendimentoDesejado: number,
): CalculadoraResultado | null {
  const padrao = Number(rendimentoPadrao) || 0
  if (padrao <= 0 || !(rendimentoDesejado > 0)) return null

  const ratio = rendimentoDesejado / padrao
  const quantidades: Record<string, number> = {}
  ingredientes.forEach((i) => {
    quantidades[i.id] = (Number(i.quantidade) || 0) * ratio
  })
  return { ratio, quantidades }
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
