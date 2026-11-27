import { ordenarPorTitulo } from '../estoque/estoqueHelpers'
import { CRIAR_PRODUTO, motivoProdutoIncompativel, unidadeEstoqueDoRendimento } from './vinculoEstoque'
import type { EstoqueItemRow, ProducaoRendimentoUnidade } from '../../types/database'

// "Produto do estoque que recebe a produção", dentro do formulário da ficha.
export function VinculoEstoqueField({
  itensDoSetor,
  fichaId,
  nomeFicha,
  rendimento,
  valor,
  onChange,
  problema,
}: {
  itensDoSetor: EstoqueItemRow[]
  fichaId: string | null
  nomeFicha: string
  rendimento: ProducaoRendimentoUnidade | ''
  valor: string
  onChange: (v: string) => void
  problema: string | null
}) {
  const unidade = unidadeEstoqueDoRendimento(rendimento)
  const nome = nomeFicha.trim()
  const mesmoNome = itensDoSetor.find((it) => it.title.trim().toLowerCase() === nome.toLowerCase())

  return (
    <div className="field">
      <label>Produto do estoque que recebe a produção</label>
      <select value={valor} onChange={(e) => onChange(e.target.value)} disabled={!unidade && !valor}>
        <option value="">Nenhum</option>
        {(!mesmoNome || valor === CRIAR_PRODUTO) && (
          <option value={CRIAR_PRODUTO} disabled={!nome || !unidade}>
            + Criar produto novo{nome ? ` "${nome}"` : ' com o nome da ficha'}
          </option>
        )}
        {ordenarPorTitulo(itensDoSetor).map((it) => {
          const motivo = motivoProdutoIncompativel(it, fichaId, rendimento)
          return (
            <option key={it.id} value={it.id} disabled={!!motivo && it.id !== valor}>
              {it.title} ({it.unidade}){motivo ? ` — ${motivo}` : ''}
            </option>
          )
        })}
      </select>
      {problema ? (
        <span className="login-error">{problema}</span>
      ) : (
        <span className="field-hint">
          {!unidade
            ? 'Escolha primeiro a unidade do rendimento, em Validade e Rendimento.'
            : !valor
              ? `Sem um produto vinculado, a tarefa de produção desta ficha não pode ser concluída.${
                  mesmoNome ? ` Já existe "${mesmoNome.title}" (${mesmoNome.unidade}) no estoque.` : ''
                }`
              : `Ao concluir a tarefa de produção no Checklist, o rendimento entra neste produto, em ${unidade}. O tipo dele passa a ser Remanufaturado.`}
        </span>
      )}
    </div>
  )
}
