import type { EstoqueItemRow, EstoqueUnidade } from '../../types/database'

// Espelha estoqueQuantidadeLabel() do protótipo (script.js:321-331) — cada
// unidade tem seu próprio sufixo/plural; sem correspondência cai no genérico
// "X unidades".
export function estoqueQuantidadeLabel(quantidade: number, unidade: EstoqueUnidade): string {
  if (unidade === 'Litro') return `${quantidade}L`
  if (unidade === 'Mililitro') return `${quantidade}ml`
  if (unidade === 'Quilo') return `${quantidade}kg`
  if (unidade === 'Grama') return `${quantidade}g`
  if (unidade === 'Caixa') return `${quantidade} ${quantidade === 1 ? 'caixa' : 'caixas'}`
  if (unidade === 'Pacote') return `${quantidade} ${quantidade === 1 ? 'pacote' : 'pacotes'}`
  if (unidade === 'Fardo') return `${quantidade} ${quantidade === 1 ? 'fardo' : 'fardos'}`
  return `${quantidade} unidades`
}

// item.min != null && quantidade <= min — mesma regra do protótipo
// (estoqueItemCritico, script.js:485-487). Comparação é <=, não <.
export function estoqueItemCritico(item: Pick<EstoqueItemRow, 'min' | 'quantidade'>): boolean {
  return item.min != null && Number(item.quantidade) <= Number(item.min)
}

// Critério da Lista de Compras: medio configurado E quantidade abaixo dele
// (estrito, < não <=) — mesma regra do protótipo (renderEstoqueCompras).
export function precisaComprar(item: Pick<EstoqueItemRow, 'medio' | 'quantidade'>): boolean {
  return item.medio != null && Number(item.quantidade) < Number(item.medio)
}

// Sugestão de compra mira 80% do estoque máximo (não o médio) — decisão do
// usuário: o médio só decide QUANDO entra na lista (precisaComprar acima), a
// quantidade sugerida é sempre calculada em cima do máximo configurado.
// Sem máximo configurado não há como calcular, então retorna null (a UI
// decide como lidar com isso). Nunca sugere comprar um número negativo.
export function sugestaoCompra(item: Pick<EstoqueItemRow, 'max' | 'quantidade'>): number | null {
  if (item.max == null) return null
  return Math.max(0, 0.8 * Number(item.max) - Number(item.quantidade))
}

export type ValidadeRotulo = 'vencido' | 'vence-hoje' | 'vence-em-dias'

export interface ValidadeInfo {
  dias: number
  rotulo: ValidadeRotulo
}

// dias até o vencimento a partir de hoje (negativo = já vencido) — mesmo
// cálculo do protótipo (estoqueValidadeAlertaTexto, script.js:3004-3023).
export function validadeInfo(validadeIso: string, hojeIso: string): ValidadeInfo {
  const dias = Math.round((Date.parse(validadeIso) - Date.parse(hojeIso)) / 86400000)
  const rotulo: ValidadeRotulo = dias < 0 ? 'vencido' : dias === 0 ? 'vence-hoje' : 'vence-em-dias'
  return { dias, rotulo }
}

export function formatValidadeRotulo(info: ValidadeInfo): string {
  if (info.rotulo === 'vencido') return 'vencido'
  if (info.rotulo === 'vence-hoje') return 'vence hoje'
  return `vence em ${info.dias} ${info.dias === 1 ? 'dia' : 'dias'}`
}

// true quando falta uma semana (7 dias) ou menos pro vencimento — inclusive
// já vencido — e há saldo (quantidade > 0). Item sem validade nunca alerta.
export function validadeProxima(item: Pick<EstoqueItemRow, 'validade' | 'quantidade'>, hojeIso: string): boolean {
  if (!item.validade || !(Number(item.quantidade) > 0)) return false
  return validadeInfo(item.validade, hojeIso).dias <= 7
}

export interface EstoqueGrupo<T> {
  chave: string
  itens: T[]
}

// Agrupa por um campo de texto (setor, categoria de produto ou subcategoria)
// em ordem alfabética (pt-BR); itens sem valor nesse campo ficam num grupo
// "semLabel" ao final. Generaliza groupEstoqueItemsByCategoria do protótipo
// (script.js:492-510) pra qualquer um dos 3 níveis (Setor > Categoria >
// Subcategoria) em vez de só um.
export function agruparPorCampo<T>(items: T[], getCampo: (item: T) => string | null, semLabel: string): EstoqueGrupo<T>[] {
  const comValor = new Map<string, T[]>()
  const semValor: T[] = []
  items.forEach((it) => {
    const valor = getCampo(it)
    if (valor) {
      const lista = comValor.get(valor) ?? []
      lista.push(it)
      comValor.set(valor, lista)
    } else {
      semValor.push(it)
    }
  })
  const grupos = [...comValor.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
    .map(([chave, itens]) => ({ chave, itens }))
  if (semValor.length) grupos.push({ chave: semLabel, itens: semValor })
  return grupos
}

export function ordenarPorTitulo<T extends { title: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
}
