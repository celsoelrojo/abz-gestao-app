import { ESTOQUE_UNIDADE_SIGLA } from './estoqueConstants'
import type { CotacaoFornecedorRow, CotacaoItemRow, CotacaoPrecoRow, CotacaoRow, EstoqueCategoria, EstoqueItemRow, EstoqueUnidade } from '../../types/database'

export interface CotFornecedor {
  id: string
  nome: string
  observacoes: string
}

export interface CotItem {
  id: string
  estoqueItemId: string | null
  produto: string
  categoria: EstoqueCategoria
  unidade: EstoqueUnidade
  quantidade: number
  // Fornecedor escolhido pra este produto (null = ainda não escolhido).
  escolhidoId: string | null
}

// item -> fornecedor -> preço por unidade do estoque (null/ausente = não cotou).
export type CotPrecos = Record<string, Record<string, number | null | undefined>>

export interface CotacaoEstado {
  id: string | null
  titulo: string
  observacoes: string
  fornecedores: CotFornecedor[]
  itens: CotItem[]
  precos: CotPrecos
}

export const novaCotacaoVazia = (): CotacaoEstado => ({ id: null, titulo: '', observacoes: '', fornecedores: [], itens: [], precos: {} })

export const novoId = (): string => crypto.randomUUID()

const arredondar = (n: number, casas = 2) => Math.round(n * 10 ** casas) / 10 ** casas

// Item da Lista de Compras -> item de cotação, com a quantidade sugerida
// (arredondada pra cima: não dá pra comprar 2,3 fardos).
export function itemDeCotacao(item: Pick<EstoqueItemRow, 'id' | 'title' | 'categoria' | 'unidade'>, quantidade: number | null): CotItem {
  return {
    id: novoId(),
    estoqueItemId: item.id,
    produto: item.title,
    categoria: item.categoria,
    unidade: item.unidade,
    quantidade: quantidade != null && quantidade > 0 ? Math.ceil(quantidade) : 1,
    escolhidoId: null,
  }
}

export function precoDe(precos: CotPrecos, itemId: string, fornecedorId: string): number | null {
  const p = precos[itemId]?.[fornecedorId]
  return p != null && p >= 0 ? p : null
}

// Menor preço informado pra um produto (empate: o fornecedor que vem primeiro).
export function menorPreco(estado: Pick<CotacaoEstado, 'fornecedores' | 'precos'>, itemId: string): { fornecedorId: string; preco: number } | null {
  let melhor: { fornecedorId: string; preco: number } | null = null
  for (const f of estado.fornecedores) {
    const p = precoDe(estado.precos, itemId, f.id)
    if (p != null && (!melhor || p < melhor.preco)) melhor = { fornecedorId: f.id, preco: p }
  }
  return melhor
}

// "Escolher o mais barato em tudo": produtos sem nenhum preço ficam como estão.
export function escolherMaisBarato(estado: CotacaoEstado): CotacaoEstado {
  return {
    ...estado,
    itens: estado.itens.map((it) => ({ ...it, escolhidoId: menorPreco(estado, it.id)?.fornecedorId ?? it.escolhidoId })),
  }
}

export interface TotaisCotacao {
  porFornecedor: Record<string, number>
  total: number
  // O que se paga a menos escolhendo esses fornecedores em vez do mais caro de cada produto.
  economia: number
}

export function totaisDaEscolha(estado: CotacaoEstado): TotaisCotacao {
  const porFornecedor: Record<string, number> = {}
  let total = 0
  let economia = 0
  for (const it of estado.itens) {
    if (!it.escolhidoId) continue
    const preco = precoDe(estado.precos, it.id, it.escolhidoId)
    if (preco == null) continue
    const subtotal = preco * it.quantidade
    porFornecedor[it.escolhidoId] = (porFornecedor[it.escolhidoId] ?? 0) + subtotal
    total += subtotal
    const precos = estado.fornecedores.map((f) => precoDe(estado.precos, it.id, f.id)).filter((p): p is number => p != null)
    economia += (Math.max(...precos) - preco) * it.quantidade
  }
  for (const k of Object.keys(porFornecedor)) porFornecedor[k] = arredondar(porFornecedor[k])
  return { porFornecedor, total: arredondar(total), economia: arredondar(economia) }
}

// O que impede de gerar os pedidos (lista vazia = pode gerar).
export function problemasParaGerarPedidos(estado: CotacaoEstado): string[] {
  const problemas: string[] = []
  if (estado.itens.length === 0) return ['Adicione ao menos um produto.']
  if (estado.fornecedores.length === 0) return ['Adicione ao menos um fornecedor.']
  for (const it of estado.itens) {
    if (!(it.quantidade > 0)) problemas.push(`"${it.produto}": informe a quantidade.`)
    else if (!it.escolhidoId) problemas.push(`"${it.produto}": escolha o fornecedor.`)
    else if (precoDe(estado.precos, it.id, it.escolhidoId) == null) problemas.push(`"${it.produto}": o fornecedor escolhido está sem preço.`)
  }
  return problemas
}

const rotuloQuantidade = (q: number, unidade: EstoqueUnidade) => `${String(Number(q.toFixed(3))).replace('.', ',')} ${ESTOQUE_UNIDADE_SIGLA[unidade]}`

// Texto pra mandar aos fornecedores (WhatsApp, e-mail) pedindo o preço.
export function textoPedidoDeCotacao(estado: Pick<CotacaoEstado, 'itens'>): string {
  const linhas = estado.itens.map((it) => `• ${rotuloQuantidade(it.quantidade, it.unidade)} — ${it.produto}`)
  return ['Olá! Poderia me passar o preço (e o prazo de entrega) destes itens?', '', ...linhas, '', 'Obrigado!'].join('\n')
}

// ---- Banco <-> estado ----

export interface CotacaoComFilhos extends CotacaoRow {
  cotacao_fornecedores: CotacaoFornecedorRow[]
  cotacao_itens: (CotacaoItemRow & { cotacao_precos: CotacaoPrecoRow[] })[]
}

export function estadoDeCotacao(c: CotacaoComFilhos): CotacaoEstado {
  const itens = [...c.cotacao_itens].sort((a, b) => a.ordem - b.ordem)
  const precos: CotPrecos = {}
  for (const it of itens) {
    precos[it.id] = {}
    for (const p of it.cotacao_precos) precos[it.id][p.fornecedor_id] = Number(p.preco_unitario)
  }
  return {
    id: c.id,
    titulo: c.titulo ?? '',
    observacoes: c.observacoes ?? '',
    fornecedores: [...c.cotacao_fornecedores].sort((a, b) => a.ordem - b.ordem).map((f) => ({ id: f.id, nome: f.nome, observacoes: f.observacoes ?? '' })),
    itens: itens.map((it) => ({
      id: it.id,
      estoqueItemId: it.estoque_item_id,
      produto: it.produto,
      categoria: it.categoria,
      unidade: it.unidade,
      quantidade: Number(it.quantidade),
      escolhidoId: it.fornecedor_escolhido_id,
    })),
    precos,
  }
}

// Payload de salvar_cotacao. Só vão preços de fornecedor/produto que ainda existem.
export function payloadDaCotacao(e: CotacaoEstado): Record<string, unknown> {
  const fornecedorIds = new Set(e.fornecedores.map((f) => f.id))
  const precos: { item_id: string; fornecedor_id: string; preco_unitario: number }[] = []
  for (const it of e.itens) {
    for (const f of e.fornecedores) {
      const p = precoDe(e.precos, it.id, f.id)
      if (p != null) precos.push({ item_id: it.id, fornecedor_id: f.id, preco_unitario: p })
    }
  }
  return {
    titulo: e.titulo,
    observacoes: e.observacoes,
    fornecedores: e.fornecedores.map((f) => ({ id: f.id, nome: f.nome.trim(), observacoes: f.observacoes })),
    itens: e.itens.map((it) => ({
      id: it.id,
      estoque_item_id: it.estoqueItemId,
      produto: it.produto,
      categoria: it.categoria,
      unidade: it.unidade,
      quantidade: it.quantidade,
      fornecedor_escolhido_id: it.escolhidoId && fornecedorIds.has(it.escolhidoId) ? it.escolhidoId : null,
    })),
    precos,
  }
}

export function tituloPadrao(hoje: Date = new Date()): string {
  return `Cotação de ${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}`
}
