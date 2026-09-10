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

// Unidades do cadastro/edição de produto. Grama e Mililitro entraram a
// pedido do usuário (já existiam no enum estoque_unidade desde a 0008, só
// não apareciam aqui).
export const ESTOQUE_UNIDADES_PRODUTO: EstoqueUnidade[] = [
  'Unidade',
  'Quilo',
  'Grama',
  'Litro',
  'Mililitro',
  'Caixa',
  'Pacote',
  'Fardo',
]

// Siglas exibidas no dropdown de unidade do cadastro/edição de produto.
export const ESTOQUE_UNIDADE_SIGLA: Record<EstoqueUnidade, string> = {
  Unidade: 'u',
  Quilo: 'kg',
  Grama: 'g',
  Litro: 'L',
  Mililitro: 'ml',
  Caixa: 'cx',
  Pacote: 'pct',
  Fardo: 'frd',
}

// Só estas 4 (medidas base) servem como unidade do "volume próprio".
export const ESTOQUE_UNIDADES_VOLUME_PROPRIO: EstoqueUnidade[] = ['Litro', 'Mililitro', 'Quilo', 'Grama']

// Unidades que têm um "volume próprio" (o produto em si tem um conteúdo
// medível): Unidade + as três embalagens.
export const ESTOQUE_UNIDADES_COM_VOLUME_PROPRIO: EstoqueUnidade[] = ['Unidade', 'Caixa', 'Pacote', 'Fardo']

// Embalagens: além do volume próprio, têm "quantas unidades vêm dentro".
export const ESTOQUE_UNIDADES_EMBALAGEM: EstoqueUnidade[] = ['Caixa', 'Pacote', 'Fardo']

// "na caixa" / "do fardo" etc. pros rótulos e dicas das embalagens.
export const ESTOQUE_EMBALAGEM_TEXTO: Record<'Caixa' | 'Pacote' | 'Fardo', { em: string; de: string }> = {
  Caixa: { em: 'na caixa', de: 'da caixa' },
  Pacote: { em: 'no pacote', de: 'do pacote' },
  Fardo: { em: 'no fardo', de: 'do fardo' },
}

export const MOTIVOS_RETIRADA: MotivoRetirada[] = [
  'Produção',
  'Uso interno',
  'Perda',
  'Vencimento',
  'Quebra',
  'Transferência',
  'Outro',
]
