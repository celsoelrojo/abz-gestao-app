import type { CSSProperties } from 'react'
import { SEM_CATEGORIA } from './estoqueHelpers'

// Filtro "Categoria do setor" (produto_categoria) reaproveitado por Estoque
// e Retirada. Some sozinho quando não há nenhuma categoria pra filtrar.
export function CategoriaFiltroSelect({
  value,
  onChange,
  categorias,
  temSemCategoria,
  style,
}: {
  value: string
  onChange: (v: string) => void
  categorias: string[]
  temSemCategoria: boolean
  style?: CSSProperties
}) {
  if (categorias.length === 0 && !temSemCategoria) return null
  return (
    <div className="field" style={style}>
      <label>Categoria do setor</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="Todas">Todas as categorias</option>
        {categorias.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
        {temSemCategoria && <option value={SEM_CATEGORIA}>Sem categoria</option>}
      </select>
    </div>
  )
}
