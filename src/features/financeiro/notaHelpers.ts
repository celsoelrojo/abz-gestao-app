import type { EstoqueUnidade, NotaMapeamentoRow } from '../../types/database'

// O que a leitura (função ler-nota) devolve. Texto vazio / 0 = "não consta na
// nota". Sempre passa por `sanearNota` antes de chegar na tela — a saída de um
// modelo nunca é confiada como está.
export interface NotaLida {
  legivel: boolean
  fornecedor: string
  cnpj: string
  numero_nota: string
  chave_acesso: string
  data_emissao: string
  // Só o XML da NF-e traz o vencimento (duplicata); a foto não — vem vazio.
  vencimento: string
  valor_total: number
  forma_pagamento: string
  itens: ItemLido[]
  observacoes: string
}

export interface ItemLido {
  descricao: string
  quantidade: number
  unidade: string
  valor_unitario: number
  valor_total: number
}

const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const numero = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 1000) / 1000 : 0
}
const dinheiro = (v: unknown): number => Math.round(numero(v) * 100) / 100
const digitos = (v: unknown): string => texto(v).replace(/\D/g, '')

export function sanearNota(raw: unknown): NotaLida {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const cnpj = digitos(r.cnpj)
  const chave = digitos(r.chave_acesso)
  const data = texto(r.data_emissao)
  const venc = texto(r.vencimento)
  const dataValida = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d))
  const itens = (Array.isArray(r.itens) ? r.itens : [])
    .map((i) => (i && typeof i === 'object' ? (i as Record<string, unknown>) : {}))
    .map((i) => ({
      descricao: texto(i.descricao),
      quantidade: numero(i.quantidade),
      unidade: texto(i.unidade).toUpperCase(),
      valor_unitario: dinheiro(i.valor_unitario),
      valor_total: dinheiro(i.valor_total),
    }))
    .filter((i) => i.descricao)
  return {
    legivel: r.legivel === true,
    fornecedor: texto(r.fornecedor),
    cnpj: cnpj.length === 14 ? cnpj : '',
    numero_nota: texto(r.numero_nota),
    chave_acesso: chave.length === 44 ? chave : '',
    data_emissao: dataValida(data) ? data : '',
    vencimento: dataValida(venc) ? venc : '',
    valor_total: dinheiro(r.valor_total),
    forma_pagamento: texto(r.forma_pagamento),
    itens,
    observacoes: texto(r.observacoes),
  }
}

// minúsculas, sem acento nem pontuação, espaços colapsados; "600 ml" vira
// "600ml" pra "CERV 600 ML" e "Cerveja 600ml" se parecerem.
export function normalizarTexto(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/(\d)\s+(ml|l|lt|g|kg|un)\b/g, '$1$2')
    .trim()
}

// Chave do "aprendizado" por fornecedor: o CNPJ quando há; senão, o nome.
export function chaveFornecedor(cnpj: string, nome: string): string {
  const d = cnpj.replace(/\D/g, '')
  return d.length === 14 ? d : normalizarTexto(nome)
}

const STOPWORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'c', 'com', 'e', 'a', 'o', 'un', 'cx', 'pct'])

function tokens(s: string): string[] {
  return normalizarTexto(s)
    .split(' ')
    .filter((t) => t && !STOPWORDS.has(t))
}

// "cerv" casa com "cerveja" (abreviação de nota); exige 3+ letras no prefixo
// pra "a"/"de" não casarem com qualquer coisa.
function tokensCasam(a: string, b: string): boolean {
  if (a === b) return true
  const [curto, longo] = a.length <= b.length ? [a, b] : [b, a]
  return curto.length >= 3 && longo.startsWith(curto)
}

// Palavras com número (600ml, 1kg) pesam metade: duas cervejas de marcas
// diferentes mas ambas "600ml" não podem parecer quase iguais.
const peso = (t: string) => (/\d/.test(t) ? 0.5 : 1)

// Dice ponderado sobre os tokens, aceitando abreviação:
// 2·peso dos casados / (peso de A + peso de B).
export function similaridade(a: string, b: string): number {
  const ta = tokens(a)
  const tbTodos = tokens(b)
  if (ta.length === 0 || tbTodos.length === 0) return 0
  const tb = [...tbTodos]
  let casados = 0
  for (const t of ta) {
    const i = tb.findIndex((u) => tokensCasam(t, u))
    if (i >= 0) {
      casados += peso(t)
      tb.splice(i, 1)
    }
  }
  const total = ta.reduce((s, t) => s + peso(t), 0) + tbTodos.reduce((s, t) => s + peso(t), 0)
  return (2 * casados) / total
}

// Quanto do NOME DO PRODUTO aparece na descrição da nota (0 a 1). Descrição de
// nota costuma ter palavras a mais (marca, peso, embalagem), então "Açúcar
// cristal" dentro de "ACUCAR CRISTAL UNIAO 5KG" cobre 100% do produto mesmo
// com a semelhança simétrica baixa. Exige ao menos uma palavra sem número.
function cobertura(descricao: string, nomeProduto: string): number {
  const alvo = tokens(descricao)
  const prod = tokens(nomeProduto)
  if (alvo.length === 0 || prod.length === 0) return 0
  let casados = 0
  let temPalavra = false
  const restantes = [...alvo]
  for (const t of prod) {
    const i = restantes.findIndex((u) => tokensCasam(t, u))
    if (i >= 0) {
      casados += peso(t)
      if (!/\d/.test(t)) temPalavra = true
      restantes.splice(i, 1)
    }
  }
  if (!temPalavra) return 0
  return casados / prod.reduce((s, t) => s + peso(t), 0)
}

function compartilhaPalavra(a: string, b: string): boolean {
  const tb = tokens(b).filter((t) => !/\d/.test(t))
  return tokens(a).some((t) => tb.some((u) => tokensCasam(t, u)))
}

// Nota da melhor leitura entre as duas medidas; a cobertura vale menos porque
// é mais permissiva ("Água" cobre "ÁGUA TÔNICA").
export function pontuarProduto(descricao: string, produto: { title: string; marca?: string | null }): number {
  // Só "600ml" em comum não faz dois produtos parecerem o mesmo.
  if (!compartilhaPalavra(descricao, produto.title)) return 0
  const comMarca = produto.marca ? `${produto.title} ${produto.marca}` : produto.title
  return Math.max(similaridade(descricao, produto.title), similaridade(descricao, comMarca), 0.85 * cobertura(descricao, comMarca))
}

const LIMIAR_CANDIDATO = 0.45

// Até `max` produtos que podem ser o da nota, do mais provável ao menos.
export function candidatosProduto<T extends { title: string; marca?: string | null }>(
  descricao: string,
  produtos: T[],
  max = 3,
): T[] {
  return produtos
    .map((p) => ({ p, score: pontuarProduto(descricao, p) }))
    .filter(({ score }) => score >= LIMIAR_CANDIDATO)
    .sort((a, b) => b.score - a.score || a.p.title.localeCompare(b.p.title))
    .slice(0, max)
    .map(({ p }) => p)
}

export interface SugestaoProduto {
  estoqueItemId: string
  // 'aprendido' = o Administrador já associou esta descrição deste fornecedor;
  // 'sugerido' = só parecido por nome (precisa conferir).
  origem: 'aprendido' | 'sugerido'
  // Unidades do estoque por 1 unidade da nota (só o vínculo aprendido sabe; senão 1).
  fator: number
}

const LIMIAR_SUGESTAO = 0.7

export function sugerirProduto(
  descricao: string,
  fornecedorChave: string,
  produtos: { id: string; title: string; marca?: string | null }[],
  mapeamentos: Pick<NotaMapeamentoRow, 'fornecedor_chave' | 'descricao_norm' | 'estoque_item_id' | 'fator'>[],
): SugestaoProduto | null {
  const norm = normalizarTexto(descricao)
  const aprendido = mapeamentos.find(
    (m) => m.fornecedor_chave === fornecedorChave && m.descricao_norm === norm && produtos.some((p) => p.id === m.estoque_item_id),
  )
  if (aprendido) return { estoqueItemId: aprendido.estoque_item_id, origem: 'aprendido', fator: aprendido.fator > 0 ? aprendido.fator : 1 }

  let melhor: { id: string; score: number } | null = null
  for (const p of produtos) {
    const score = pontuarProduto(descricao, p)
    if (score >= LIMIAR_SUGESTAO && (!melhor || score > melhor.score)) melhor = { id: p.id, score }
  }
  return melhor ? { estoqueItemId: melhor.id, origem: 'sugerido', fator: 1 } : null
}

// Lista do seletor de produto: com busca, só quem contém todas as palavras
// (título ou marca); sem busca, todos. Em ambos, os mais parecidos com a
// descrição da nota vêm primeiro, depois ordem alfabética.
export function ordenarProdutosParaNota<T extends { title: string; marca?: string | null }>(
  descricaoNota: string,
  produtos: T[],
  busca: string,
): T[] {
  const palavras = normalizarTexto(busca).split(' ').filter(Boolean)
  return produtos
    .filter((p) => {
      if (palavras.length === 0) return true
      const alvo = normalizarTexto(`${p.title} ${p.marca ?? ''}`)
      return palavras.every((w) => alvo.includes(w))
    })
    .map((p) => ({ p, score: similaridade(descricaoNota, p.title) }))
    .sort((a, b) => b.score - a.score || a.p.title.localeCompare(b.p.title))
    .map(({ p }) => p)
}

// Quantas unidades do estoque entram por 1 da nota, a partir do que a pessoa
// conferiu. Sem número válido dos dois lados, não dá pra concluir nada.
export function fatorDeConversao(quantidadeNota: number, quantidadeEstoque: number): number | null {
  if (!(quantidadeNota > 0) || !(quantidadeEstoque > 0)) return null
  const f = Math.round((quantidadeEstoque / quantidadeNota) * 10000) / 10000
  return f > 0 ? f : null
}

const UNIDADES_DA_NOTA: Record<string, EstoqueUnidade> = {
  CX: 'Caixa', CXA: 'Caixa', CAIXA: 'Caixa',
  FD: 'Fardo', FARDO: 'Fardo',
  PCT: 'Pacote', PC: 'Pacote', PCTE: 'Pacote', PACOTE: 'Pacote',
  UN: 'Unidade', UND: 'Unidade', UNID: 'Unidade', UNIDADE: 'Unidade', PEC: 'Unidade', PECA: 'Unidade',
  KG: 'Quilo', QUILO: 'Quilo',
  G: 'Grama', GR: 'Grama', GRAMA: 'Grama',
  L: 'Litro', LT: 'Litro', LTS: 'Litro', LITRO: 'Litro',
  ML: 'Mililitro',
}

export function unidadeDaNota(unidade: string): EstoqueUnidade | null {
  return UNIDADES_DA_NOTA[unidade.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z]/g, '').toUpperCase()] ?? null
}

const EMBALAGENS: EstoqueUnidade[] = ['Caixa', 'Fardo', 'Pacote']

// Melhor palpite de quantas unidades do estoque entram por 1 da nota, só pelas
// unidades (sem histórico): mesma unidade = 1; kg↔g e l↔ml pelo tamanho;
// embalagem da nota → "Unidade" do estoque pelas unidades por embalagem do
// cadastro. null = não dá pra saber (a pessoa informa a quantidade).
export function fatorPorUnidades(
  unidadeNota: string,
  produto: { unidade: EstoqueUnidade; unidades_por_embalagem: number | null },
): number | null {
  const nota = unidadeDaNota(unidadeNota)
  if (!nota) return null
  const est = produto.unidade
  if (nota === est) return 1
  if (nota === 'Quilo' && est === 'Grama') return 1000
  if (nota === 'Grama' && est === 'Quilo') return 0.001
  if (nota === 'Litro' && est === 'Mililitro') return 1000
  if (nota === 'Mililitro' && est === 'Litro') return 0.001
  const porEmbalagem = produto.unidades_por_embalagem
  if (porEmbalagem && porEmbalagem > 0) {
    if (EMBALAGENS.includes(nota) && est === 'Unidade') return porEmbalagem
    if (nota === 'Unidade' && EMBALAGENS.includes(est)) return Math.round((1 / porEmbalagem) * 10000) / 10000
  }
  return null
}

export function quantidadeNoEstoque(quantidadeNota: number, fator: number): number {
  return Math.round(quantidadeNota * fator * 1000) / 1000
}

export function somaItens(itens: { valor_total: number }[]): number {
  return Math.round(itens.reduce((s, i) => s + i.valor_total, 0) * 100) / 100
}

// Diferença entre o total da nota e a soma dos itens (desconto, frete e
// arredondamento explicam centavos; mais que isso merece conferência).
export function divergenciaTotal(total: number, itens: { valor_total: number }[]): number {
  return Math.round((total - somaItens(itens)) * 100) / 100
}

export function notaFormError(input: {
  descricao: string
  valor: number | null
  vencimento: string
  pagaEm: string | null
  pagaSemData: boolean
}): string | null {
  if (!input.descricao.trim()) return 'Informe a descrição da conta.'
  if (input.valor == null || input.valor <= 0) return 'Informe o valor total da nota (maior que zero).'
  if (!input.vencimento) return 'Informe o vencimento.'
  if (input.pagaSemData) return 'Informe a data do pagamento.'
  return null
}
