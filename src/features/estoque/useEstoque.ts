import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type {
  EstoqueCategoria,
  EstoqueCondicaoArmazenamento,
  EstoqueItemRow,
  EstoqueMovimentoRow,
  EstoqueTipoProduto,
  EstoqueUnidade,
  TaxonomiaRow,
  UnidadeValidade,
} from '../../types/database'

export const ESTOQUE_ITENS_KEY = ['estoque_itens']
export const ESTOQUE_MOVIMENTOS_KEY = ['estoque_movimentos']
export const TAXONOMIAS_KEY = (modulo: string) => ['taxonomias', modulo]
export const FICHAS_PRODUCAO_OPTIONS_KEY = (setor: string) => ['fichas_producao_options', setor]

// RLS já restringe pra categoria do próprio setor (ou tudo, se Administrador)
// — o client só pede tudo que existir.
export function useEstoqueItens() {
  return useQuery({
    queryKey: ESTOQUE_ITENS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('estoque_itens').select('*').order('title')
      if (error) throw error
      return data as EstoqueItemRow[]
    },
  })
}

// Histórico completo de movimentos (entradas + saídas + estornos) — os
// filtros da aba Retirada são aplicados no client sobre esta mesma lista,
// igual ao protótipo (não há tela própria de "histórico de entradas").
export function useEstoqueMovimentos() {
  return useQuery({
    queryKey: ESTOQUE_MOVIMENTOS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_movimentos')
        .select('*')
        .order('data_hora', { ascending: false })
      if (error) throw error
      return data as EstoqueMovimentoRow[]
    },
  })
}

export function useTaxonomias(modulo: 'estoque' | 'ficha_tecnica' | 'ficha_producao' | 'pop') {
  return useQuery({
    queryKey: TAXONOMIAS_KEY(modulo),
    queryFn: async () => {
      const { data, error } = await supabase.from('taxonomias').select('*').eq('modulo', modulo)
      if (error) throw error
      return data as TaxonomiaRow[]
    },
  })
}

// Sugestões de categoria/subcategoria pro setor — mesma mecânica do
// protótipo (fichaCategoriasPorSetor/estoqueCategoriasPorSetor etc.), só que
// numa tabela genérica (taxonomias) em vez de um objeto por módulo em
// memória. São só sugestões de datalist; o usuário pode digitar livre.
export function taxonomiaValores(taxonomias: TaxonomiaRow[], setor: string, tipo: 'categoria' | 'subcategoria') {
  return taxonomias.filter((t) => t.setor === setor && t.tipo === tipo).map((t) => t.valor)
}

// Registra categoria/subcategoria novas na tabela de sugestões — ignora
// silenciosamente se já existir (unique constraint faz esse trabalho; 23505
// = unique_violation).
export async function registrarTaxonomia(
  modulo: 'estoque' | 'ficha_tecnica' | 'ficha_producao' | 'pop',
  setor: string,
  categoria: string,
  subcategoria: string,
) {
  const rows: { modulo: string; setor: string; tipo: 'categoria' | 'subcategoria'; valor: string }[] = []
  if (categoria.trim()) rows.push({ modulo, setor, tipo: 'categoria', valor: categoria.trim() })
  if (subcategoria.trim()) rows.push({ modulo, setor, tipo: 'subcategoria', valor: subcategoria.trim() })
  if (!rows.length) return
  const { error } = await supabase.from('taxonomias').insert(rows)
  if (error && error.code !== '23505') throw error
}

// Realtime: qualquer INSERT/UPDATE/DELETE em itens ou movimentos invalida o
// cache — é assim que uma entrada/retirada lançada por outro usuário (ou
// pela conclusão de uma tarefa de produção no Checklist) aparece na hora.
export function useEstoqueRealtime() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel('estoque:all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estoque_itens' }, () => {
        queryClient.invalidateQueries({ queryKey: ESTOQUE_ITENS_KEY })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estoque_movimentos' }, () => {
        queryClient.invalidateQueries({ queryKey: ESTOQUE_MOVIMENTOS_KEY })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}

// Fichas de Produção do setor — usadas só pra popular o vínculo "Ficha de
// preparo" no cadastro de produto Remanufaturado. Salão/Material de
// Limpeza/Outros nunca têm fichas_producao (setor lá é sempre Bar/Cozinha),
// então devolve lista vazia sem nem consultar o banco.
export function useFichasProducaoOptions(setor: EstoqueCategoria | null) {
  return useQuery({
    queryKey: FICHAS_PRODUCAO_OPTIONS_KEY(setor ?? ''),
    queryFn: async () => {
      if (setor !== 'Bar' && setor !== 'Cozinha') return []
      const { data, error } = await supabase.from('fichas_producao').select('id, nome').eq('setor', setor).order('nome')
      if (error) throw error
      return data as { id: string; nome: string }[]
    },
    enabled: !!setor,
  })
}

// Cadastro de produto (tela "Cadastrar Produto") — cria a linha em
// estoque_itens com saldo zerado e todos os metadados do formulário. Mesma
// tabela usada por Entrada/Retirada/Limites/Compras, então esse cadastro já
// vira a base pra tudo, como pedido. Unique(categoria, title) devolve 23505
// se já existir produto com esse nome no setor — traduzido pra mensagem
// amigável em vez do erro cru do Postgres.
export async function criarProdutoEstoque(input: {
  categoria: EstoqueCategoria
  title: string
  tipoProduto: EstoqueTipoProduto
  marca: string | null
  produtoCategoria: string | null
  subcategoria: string | null
  unidade: EstoqueUnidade
  volumePadrao: number | null
  condicaoArmazenamento: EstoqueCondicaoArmazenamento
  prazoValidade: number | null
  unidadeValidade: UnidadeValidade | null
  fichaProducaoId: string | null
}): Promise<EstoqueItemRow> {
  const { data, error } = await supabase
    .from('estoque_itens')
    .insert({
      categoria: input.categoria,
      title: input.title.trim(),
      quantidade: 0,
      unidade: input.unidade,
      produto_categoria: input.produtoCategoria,
      subcategoria: input.subcategoria,
      tipo_produto: input.tipoProduto,
      marca: input.marca,
      volume_padrao: input.volumePadrao,
      condicao_armazenamento: input.condicaoArmazenamento,
      prazo_validade: input.prazoValidade,
      unidade_validade: input.unidadeValidade,
      ficha_producao_id: input.fichaProducaoId,
    })
    .select('*')
    .single()
  if (error) {
    if (error.code === '23505') throw new Error('Já existe um produto com esse nome cadastrado neste setor.')
    throw error
  }
  return data as EstoqueItemRow
}

// Edição do cadastro (botão "Ver/editar produtos") — mesmos campos do
// cadastro, exceto Setor (categoria): mudar o setor de um item que já pode
// ter saldo/movimentos/limites configurados é uma operação bem maior
// (RLS, histórico, listas de compra por setor) e não foi pedida; quem
// precisar disso hoje cria um produto novo no setor certo.
export async function atualizarProdutoEstoque(
  id: string,
  input: {
    title: string
    tipoProduto: EstoqueTipoProduto
    marca: string | null
    produtoCategoria: string | null
    subcategoria: string | null
    unidade: EstoqueUnidade
    volumePadrao: number | null
    condicaoArmazenamento: EstoqueCondicaoArmazenamento
    prazoValidade: number | null
    unidadeValidade: UnidadeValidade | null
    fichaProducaoId: string | null
  },
): Promise<EstoqueItemRow> {
  const { data, error } = await supabase
    .from('estoque_itens')
    .update({
      title: input.title.trim(),
      unidade: input.unidade,
      produto_categoria: input.produtoCategoria,
      subcategoria: input.subcategoria,
      tipo_produto: input.tipoProduto,
      marca: input.marca,
      volume_padrao: input.volumePadrao,
      condicao_armazenamento: input.condicaoArmazenamento,
      prazo_validade: input.prazoValidade,
      unidade_validade: input.unidadeValidade,
      ficha_producao_id: input.fichaProducaoId,
    })
    .eq('id', id)
    .select('*')
    .single()
  if (error) {
    if (error.code === '23505') throw new Error('Já existe um produto com esse nome cadastrado neste setor.')
    throw error
  }
  return data as EstoqueItemRow
}

// Exclusão do cadastro (botão 🗑 em "Produtos cadastrados") — só
// Administrador (RLS estoque_itens_admin_delete, migration 0029). O Postgres
// ainda recusa apagar um produto que já tem entrada/retirada registrada
// (estoque_movimentos.item_id é FK obrigatória, sem ON DELETE) — de
// propósito, apagar o cadastro nunca deve apagar histórico de movimentação.
// 23503 = foreign_key_violation, traduzido pra mensagem amigável.
export async function excluirProdutoEstoque(id: string): Promise<void> {
  const { error } = await supabase.from('estoque_itens').delete().eq('id', id)
  if (error) {
    if (error.code === '23503') {
      throw new Error('Não é possível excluir: este produto já tem entradas ou retiradas registradas no histórico.')
    }
    throw error
  }
}

// Ajuste manual de quantidade (botão "⚖ Ajustar" na aba Estoque) — só
// Administrador (checado de novo dentro da função, RPC é SECURITY DEFINER).
// Sempre passa a quantidade ATUAL da linha, não a diferença — o RPC calcula
// e grava a diferença no movimento (pode ser negativa), pra manter o mesmo
// histórico auditável de Entrada/Retirada em vez de um UPDATE direto sem
// rastro.
export async function ajustarQuantidadeEstoque(itemId: string, novaQuantidade: number, observacao: string | null): Promise<void> {
  const { error } = await supabase.rpc('registrar_ajuste_estoque', {
    p_item_id: itemId,
    p_nova_quantidade: novaQuantidade,
    p_observacao: observacao,
  })
  if (error) throw error
}

// Nota: existiu aqui um findOrCreateEstoqueItem() usado pela aba "Entrada no
// Estoque" pra criar produto na hora, digitando o nome livre. Removido
// quando Entrada passou a exigir produto já cadastrado (ver
// EstoqueCadastrarProdutoTab/criarProdutoEstoque acima) — pedido do usuário
// pra centralizar o cadastro num único lugar.
