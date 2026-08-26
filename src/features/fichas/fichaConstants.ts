import type { ProducaoIngredienteTipo, UnidadeValidade } from '../../types/database'

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

export const UNIDADES_VALIDADE: UnidadeValidade[] = ['Horas', 'Dias', 'Semanas', 'Meses']

export const CONDICOES_ARMAZENAMENTO = ['Ambiente', 'Refrigerado', 'Congelado', 'Outro']

export const PRODUCAO_INGREDIENTE_TIPO_LABELS: Record<ProducaoIngredienteTipo, string> = {
  base: 'Base',
  secundario: 'Secundário',
  variavel: 'Variável',
}

// Unidades usadas nos ingredientes de Ficha Técnica/Produção — texto livre
// com sugestão, mas mantemos uma lista curta pra datalist.
export const FICHA_UNIDADES_SUGERIDAS = ['Quilo', 'Grama', 'Litro', 'Mililitro', 'Unidade', 'Caixa', 'Pacote']
