import type { EstoqueItemRow } from '../../types/database'

export type ModoQuantidade = 'embalagem' | 'soltas'

// Alterna entre contar em embalagens (fardos, pacotes, caixas) e em unidades
// soltas. Só aparece pra produto de embalagem com "unidades por embalagem".
export function ModoQuantidadeEmbalagem({
  item,
  modo,
  onChange,
}: {
  item: Pick<EstoqueItemRow, 'unidade' | 'unidades_por_embalagem'>
  modo: ModoQuantidade
  onChange: (m: ModoQuantidade) => void
}) {
  const nome = item.unidade.toLowerCase()
  return (
    <div className="sector-filter" style={{ marginBottom: 8 }}>
      <button type="button" className={`sector-filter-btn ${modo === 'embalagem' ? 'active' : ''}`} onClick={() => onChange('embalagem')}>
        Em {nome}s
      </button>
      <button type="button" className={`sector-filter-btn ${modo === 'soltas' ? 'active' : ''}`} onClick={() => onChange('soltas')}>
        Em unidades soltas
      </button>
    </div>
  )
}
