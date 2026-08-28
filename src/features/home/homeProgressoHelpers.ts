import type { ResumoTarefas } from './useChecklistResumoDia'

export interface ProgressoInfo {
  pct: number
  restantes: number
  mostrarFraseIncentivo: boolean
}

// Pedido do usuário: quando faltar 15% ou menos das tarefas do dia (e ainda
// faltar alguma — tudo concluído não é "faltando"), mostra a frase de
// incentivo. `permitirFraseIncentivo` existe pra restringir isso só à barra
// geral do estabelecimento (a barra por setor não menciona a frase no
// pedido original).
export function calcularProgresso(resumo: ResumoTarefas, permitirFraseIncentivo: boolean): ProgressoInfo {
  const { total, feitas } = resumo
  const pct = total > 0 ? Math.round((feitas / total) * 100) : 0
  const restantes = total - feitas
  const percentualRestante = total > 0 ? 100 - pct : 0
  const mostrarFraseIncentivo = permitirFraseIncentivo && total > 0 && restantes > 0 && percentualRestante <= 15
  return { pct, restantes, mostrarFraseIncentivo }
}
