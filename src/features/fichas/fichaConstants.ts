import type { ProducaoCondicaoArmazenamento, ProducaoRendimentoUnidade, UnidadeValidade } from '../../types/database'

// Setores possíveis pra Fichas Técnicas/Produção — Salão nunca cozinha/serve
// drink ou prato, então fica de fora (mesma regra do protótipo).
export const FICHA_SETORES = ['Bar', 'Cozinha'] as const

export const FICHA_PRODUCAO_CATEGORIAS = [
  'Base',
  'Molho',
  'Xarope',
  'Calda',
  'Guarnição',
  'Pré-preparo',
  'Mise en place',
  'Outro',
]

// Usada só por Fichas Técnicas (Ficha de Produção grava sempre 'Dias' — o
// pedido do usuário foi "prazo de validade em dias", sem seletor de unidade).
export const UNIDADES_VALIDADE: UnidadeValidade[] = ['Horas', 'Dias', 'Semanas', 'Meses']

export const PRODUCAO_CONDICOES_ARMAZENAMENTO: ProducaoCondicaoArmazenamento[] = ['Ambiente', 'Resfriado', 'Congelado']

export const PRODUCAO_UNIDADES_RENDIMENTO: ProducaoRendimentoUnidade[] = ['Litros', 'Quilos', 'Unidade', 'Porção']

// Unidades dos ingredientes de Ficha Técnica — texto livre com sugestão,
// mantemos uma lista curta pra datalist. (Ficha de Produção não usa mais
// isso: o ingrediente agora é sempre um item do estoque, cuja unidade já
// vem pronta.)
export const FICHA_UNIDADES_SUGERIDAS = ['Quilo', 'Grama', 'Litro', 'Mililitro', 'Unidade', 'Caixa', 'Pacote']
