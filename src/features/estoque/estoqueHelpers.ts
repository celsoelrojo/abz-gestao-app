import type { EstoqueCategoria, EstoqueItemRow, EstoqueUnidade, TaxonomiaRow } from '../../types/database'
import {
  ESTOQUE_CATEGORIAS,
  ESTOQUE_UNIDADES_EMBALAGEM,
  ESTOQUE_UNIDADES_VOLUME_PROPRIO,
  ESTOQUE_UNIDADE_SIGLA,
} from './estoqueConstants'

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

const round3 = (n: number) => Math.round(n * 1000) / 1000

// Nº de unidades individuais em estoque — só faz sentido pra embalagens
// (Caixa/Pacote/Fardo) com "unidades por embalagem" configurada: aí o saldo
// está em embalagens, não em unidades soltas. Pra "Unidade" o saldo já É o
// número de unidades; pra medida base (L/ml/kg/g) não existe "unidade".
export function estoqueUnidadesIndividuais(
  item: Pick<EstoqueItemRow, 'quantidade' | 'unidade' | 'unidades_por_embalagem'>,
): number | null {
  if (ESTOQUE_UNIDADES_EMBALAGEM.includes(item.unidade) && item.unidades_por_embalagem != null) {
    return round3(Number(item.quantidade) * Number(item.unidades_por_embalagem))
  }
  return null
}

// Volume/peso total em estoque, na unidade do volume próprio:
// - medida base (L/ml/kg/g): o próprio saldo já é o volume
// - Unidade / embalagem com volume próprio: saldo × (unids por embalagem) × volume próprio
export function estoqueVolumeTotal(
  item: Pick<
    EstoqueItemRow,
    'quantidade' | 'unidade' | 'volume_padrao' | 'volume_padrao_unidade' | 'unidades_por_embalagem'
  >,
): { valor: number; unidade: EstoqueUnidade } | null {
  if (ESTOQUE_UNIDADES_VOLUME_PROPRIO.includes(item.unidade)) {
    return { valor: round3(Number(item.quantidade)), unidade: item.unidade }
  }
  if (item.volume_padrao == null || item.volume_padrao_unidade == null) return null
  const porEmbalagem = ESTOQUE_UNIDADES_EMBALAGEM.includes(item.unidade)
    ? Number(item.unidades_por_embalagem ?? 1)
    : 1
  return {
    valor: round3(Number(item.quantidade) * porEmbalagem * Number(item.volume_padrao)),
    unidade: item.volume_padrao_unidade,
  }
}

// "18 L" a partir de 18000 ml — normaliza ml→L e g→kg quando passa de 1000,
// senão mantém a unidade com a sigla curta.
export function estoqueVolumeLabel(valor: number, unidade: EstoqueUnidade): string {
  if (unidade === 'Mililitro' && valor >= 1000) return `${round3(valor / 1000)} L`
  if (unidade === 'Grama' && valor >= 1000) return `${round3(valor / 1000)} kg`
  return `${round3(valor)} ${ESTOQUE_UNIDADE_SIGLA[unidade]}`
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

// Subcategorias (taxonomias) que pertencem à categoria escolhida — pedido do
// usuário: escolher "Bebidas alcoólicas" mostra só Destilada/Amari/Licores.
// O vínculo é por categoria_pai (valor da categoria mãe). Sem categoria
// escolhida (categoriaPai vazio) devolve as ainda não vinculadas
// (categoria_pai null) pra continuarem visíveis e organizáveis. Ordem pt-BR,
// sem repetidos.
export function subcategoriasDaCategoria(
  taxonomias: Pick<TaxonomiaRow, 'setor' | 'tipo' | 'valor' | 'categoria_pai'>[],
  setor: string,
  categoriaPai: string,
): string[] {
  const alvo = categoriaPai.trim()
  const valores = taxonomias
    .filter(
      (t) =>
        t.setor === setor &&
        t.tipo === 'subcategoria' &&
        (alvo ? t.categoria_pai === alvo : t.categoria_pai == null),
    )
    .map((t) => t.valor)
  return [...new Set(valores)].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

// Categorias de produto (produto_categoria) distintas presentes numa lista,
// em ordem pt-BR — usado pra montar o filtro "Categoria do setor" em Estoque
// e Retirada. Sentinela pra itens sem categoria.
export const SEM_CATEGORIA = '__sem_categoria__'

export function categoriasPresentes(items: Pick<EstoqueItemRow, 'produto_categoria'>[]): string[] {
  const set = new Set<string>()
  items.forEach((it) => {
    if (it.produto_categoria) set.add(it.produto_categoria)
  })
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

// Aplica o filtro de categoria escolhido ('Todas' | SEM_CATEGORIA | nome).
export function filtrarPorCategoria<T extends Pick<EstoqueItemRow, 'produto_categoria'>>(
  items: T[],
  filtroCategoria: string,
): T[] {
  if (filtroCategoria === 'Todas') return items
  if (filtroCategoria === SEM_CATEGORIA) return items.filter((it) => !it.produto_categoria)
  return items.filter((it) => it.produto_categoria === filtroCategoria)
}

// Agrupa por setor na ordem canônica de ESTOQUE_CATEGORIAS (Bar, Cozinha,
// Salão, Material de Limpeza, Outros) — não alfabética como agruparPorCampo.
// Setor sem nenhum item é omitido.
export function agruparPorSetor<T extends { categoria: EstoqueCategoria }>(items: T[]): EstoqueGrupo<T>[] {
  return ESTOQUE_CATEGORIAS.map((cat) => ({ chave: cat, itens: items.filter((it) => it.categoria === cat) })).filter(
    (g) => g.itens.length > 0,
  )
}
