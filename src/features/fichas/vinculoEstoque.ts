// Vínculo "ficha de produção → produto do Estoque que recebe a entrada". O
// vínculo mora no produto (estoque_itens.ficha_producao_id, migration 0024) e é
// por ele que registrar_producao_checklist acha onde dar entrada.
import type {
  EstoqueCondicaoArmazenamento,
  EstoqueItemRow,
  EstoqueUnidade,
  ProducaoCondicaoArmazenamento,
  ProducaoRendimentoUnidade,
} from '../../types/database'

// Valor do select que pede pra criar o produto junto com a ficha.
export const CRIAR_PRODUTO = '__criar__'

// A produção soma o número do rendimento direto no saldo, SEM converter: o
// produto precisa contar na mesma unidade do rendimento da ficha.
const UNIDADE_DO_RENDIMENTO: Record<ProducaoRendimentoUnidade, EstoqueUnidade> = {
  Litros: 'Litro',
  Quilos: 'Quilo',
  Unidade: 'Unidade',
  Porção: 'Unidade',
}

export function unidadeEstoqueDoRendimento(rendimento: ProducaoRendimentoUnidade | '' | null): EstoqueUnidade | null {
  return rendimento ? UNIDADE_DO_RENDIMENTO[rendimento] : null
}

export const CONDICAO_ESTOQUE_DA_FICHA: Record<ProducaoCondicaoArmazenamento, EstoqueCondicaoArmazenamento> = {
  Ambiente: 'Ambiente',
  Resfriado: 'Refrigerado',
  Congelado: 'Congelado',
}

// Por que este produto não pode receber a produção da ficha (null = pode).
export function motivoProdutoIncompativel(
  item: Pick<EstoqueItemRow, 'unidade' | 'ficha_producao_id'>,
  fichaId: string | null,
  rendimento: ProducaoRendimentoUnidade | '' | null,
): string | null {
  if (item.ficha_producao_id && item.ficha_producao_id !== fichaId) return 'já ligado a outra ficha'
  const unidade = unidadeEstoqueDoRendimento(rendimento)
  if (unidade && item.unidade !== unidade) return `está em ${item.unidade}, a ficha rende em ${rendimento}`
  return null
}

// O que mudar no Estoque pra ficha ficar ligada só ao produto escolhido
// ('' = nenhum): a produção dá entrada em um único produto.
export function mudancasDeVinculo(
  itens: Pick<EstoqueItemRow, 'id' | 'ficha_producao_id'>[],
  fichaId: string,
  escolhidoId: string,
): { desligar: string[]; ligar: string | null } {
  const ligados = itens.filter((it) => it.ficha_producao_id === fichaId).map((it) => it.id)
  return {
    desligar: ligados.filter((id) => id !== escolhidoId),
    ligar: escolhidoId && !ligados.includes(escolhidoId) ? escolhidoId : null,
  }
}
