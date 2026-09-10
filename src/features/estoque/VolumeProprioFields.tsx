import { useMemo } from 'react'
import {
  ESTOQUE_EMBALAGEM_TEXTO,
  ESTOQUE_UNIDADES_COM_VOLUME_PROPRIO,
  ESTOQUE_UNIDADES_EMBALAGEM,
  ESTOQUE_UNIDADES_VOLUME_PROPRIO,
  ESTOQUE_UNIDADE_SIGLA,
} from './estoqueConstants'
import type { EstoqueUnidade } from '../../types/database'

// Campos condicionais do cadastro/edição de produto (pedido do usuário):
// - unidade "Unidade"              → volume próprio + unidade desse volume
// - Caixa / Pacote / Fardo         → quantas unidades vêm dentro + volume
//                                    próprio de cada unidade + unidade do volume
// - Quilo / Grama / Litro / Mililitro → nada (a unidade já É a medida)
export function VolumeProprioFields({
  unidade,
  volumePadrao,
  onVolumePadrao,
  volumePadraoUnidade,
  onVolumePadraoUnidade,
  unidadesPorEmbalagem,
  onUnidadesPorEmbalagem,
}: {
  unidade: EstoqueUnidade
  volumePadrao: string
  onVolumePadrao: (v: string) => void
  volumePadraoUnidade: EstoqueUnidade | ''
  onVolumePadraoUnidade: (v: EstoqueUnidade | '') => void
  unidadesPorEmbalagem: string
  onUnidadesPorEmbalagem: (v: string) => void
}) {
  const temEmbalagem = ESTOQUE_UNIDADES_EMBALAGEM.includes(unidade)
  const temVolumeProprio = ESTOQUE_UNIDADES_COM_VOLUME_PROPRIO.includes(unidade)
  const embalagemTxt = useMemo(
    () => (temEmbalagem ? ESTOQUE_EMBALAGEM_TEXTO[unidade as 'Caixa' | 'Pacote' | 'Fardo'] : null),
    [temEmbalagem, unidade],
  )

  if (!temVolumeProprio) return null

  return (
    <>
      {embalagemTxt && (
        <div className="field">
          <label>Unidades {embalagemTxt.em}</label>
          <input
            type="number"
            min="1"
            step="1"
            value={unidadesPorEmbalagem}
            onChange={(e) => onUnidadesPorEmbalagem(e.target.value)}
            placeholder="ex.: 12"
          />
        </div>
      )}
      <div className="field-row">
        <div className="field">
          <label>Volume próprio</label>
          <input
            type="number"
            min="0"
            step="any"
            value={volumePadrao}
            onChange={(e) => onVolumePadrao(e.target.value)}
            placeholder="ex.: 750"
          />
          <span className="field-hint">
            {embalagemTxt ? `Conteúdo de cada unidade ${embalagemTxt.de}.` : 'Conteúdo de uma unidade do produto.'}
          </span>
        </div>
        <div className="field">
          <label>Unidade do volume</label>
          <select
            value={volumePadraoUnidade}
            onChange={(e) => onVolumePadraoUnidade(e.target.value as EstoqueUnidade | '')}
          >
            <option value="" disabled>
              Selecione...
            </option>
            {ESTOQUE_UNIDADES_VOLUME_PROPRIO.map((u) => (
              <option key={u} value={u}>
                {u} ({ESTOQUE_UNIDADE_SIGLA[u]})
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  )
}
