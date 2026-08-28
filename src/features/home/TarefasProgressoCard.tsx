import { calcularProgresso } from './homeProgressoHelpers'
import type { ResumoTarefas } from './useChecklistResumoDia'

// Pedido do usuário: cada barra mostra tanto a porcentagem quanto a fração
// ("1 de 10") — e a barra geral, quando faltar 15% ou menos das tarefas do
// dia (e ainda faltar alguma), ganha a frase de incentivo.
export function TarefasProgressoCard({
  titulo,
  resumo,
  mostrarFraseIncentivo,
}: {
  titulo: string
  resumo: ResumoTarefas
  mostrarFraseIncentivo?: boolean
}) {
  const { total, feitas } = resumo
  const { pct, mostrarFraseIncentivo: mostrarFrase } = calcularProgresso(resumo, !!mostrarFraseIncentivo)

  return (
    <div className="progress-card">
      <div className="progress-info">
        <strong>{titulo}</strong>
        <span className="progress-percent">{total > 0 ? `${pct}%` : '—'}</span>
      </div>
      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="task-meta">
        <span>{total > 0 ? `${feitas} de ${total} tarefas concluídas` : 'Nenhuma tarefa programada para hoje.'}</span>
      </div>
      {mostrarFrase && <p className="progress-incentivo">Se ajudando as coisas ficam mais fáceis.</p>}
    </div>
  )
}
