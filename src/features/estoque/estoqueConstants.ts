import type {
  EstoqueCategoria,
  EstoqueCondicaoArmazenamento,
  EstoqueTipoProduto,
  EstoqueUnidade,
  MotivoRetirada,
  UnidadeValidade,
} from '../../types/database'

export const ESTOQUE_CATEGORIAS: EstoqueCategoria[] = ['Bar', 'Cozinha', 'Salão', 'Material de Limpeza', 'Outros']

export const ESTOQUE_TIPOS_PRODUTO: EstoqueTipoProduto[] = ['Matéria Prima', 'Remanufaturado', 'Pronto para Venda']

export const ESTOQUE_CONDICOES_ARMAZENAMENTO: EstoqueCondicaoArmazenamento[] = ['Ambiente', 'Refrigerado', 'Congelado']

// Mesmo vocabulário de fichas_producao.unidade_validade — reaproveitado no
// prazo de validade do cadastro de produto remanufaturado.
export const UNIDADES_VALIDADE: UnidadeValidade[] = ['Horas', 'Dias', 'Semanas', 'Meses']

// Unidades do formulário "Dar Entrada no Estoque" — mesma lista do
// protótipo (ESTOQUE_UNIDADES, script.js:277).
export const ESTOQUE_UNIDADES_ENTRADA: EstoqueUnidade[] = ['Caixa', 'Unidade', 'Quilo', 'Litro', 'Grama', 'Mililitro']

// Unidades do cadastro "+ Adicionar Produto" — DELIBERADAMENTE diferente da
// lista acima (ESTOQUE_PRODUTO_UNIDADES, script.js:284) — o protótipo mantém
// as duas listas distintas, então replicamos a mesma assimetria.
export const ESTOQUE_UNIDADES_PRODUTO: EstoqueUnidade[] = ['Quilo', 'Litro', 'Unidade', 'Caixa', 'Pacote', 'Fardo']

export const MOTIVOS_RETIRADA: MotivoRetirada[] = [
  'Produção',
  'Uso interno',
  'Perda',
  'Vencimento',
  'Quebra',
  'Transferência',
  'Outro',
]
