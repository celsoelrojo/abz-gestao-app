import type { EstoqueCategoria, EstoqueUnidade, MotivoRetirada } from '../../types/database'

export const ESTOQUE_CATEGORIAS: EstoqueCategoria[] = ['Bar', 'Cozinha', 'Salão', 'Material de Limpeza', 'Outros']

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
