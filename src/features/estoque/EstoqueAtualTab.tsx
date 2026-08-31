import { useMemo, useState } from 'react'
import { isFullAdmin, useAuthStore } from '../../store/authStore'
import { visibleCategorias } from './estoqueAccess'
import { useEstoqueItens } from './useEstoque'
import { EstoqueItemList } from './EstoqueItemList'
import type { EstoqueCategoria } from '../../types/database'

// Só leitura — cadastrar produto novo e dar saldo inicial agora é tudo feito
// em "Entrada no Estoque" (ver EstoqueEntradaTab). Esta tela existe só pra
// consultar o que tem, Setor > Categoria > Subcategoria.
export function EstoqueAtualTab() {
  const profile = useAuthStore((s) => s.profile)
  const { data: itens, isLoading } = useEstoqueItens()
  const setores = visibleCategorias(profile)
  const admin = isFullAdmin(profile)

  const [filtro, setFiltro] = useState<EstoqueCategoria | 'Todos'>(admin ? 'Todos' : (setores[0] ?? 'Bar'))

  const itensFiltrados = useMemo(() => {
    const escopo = (itens ?? []).filter((it) => setores.includes(it.categoria))
    if (filtro === 'Todos') return escopo
    return escopo.filter((it) => it.categoria === filtro)
  }, [itens, setores, filtro])

  if (isLoading) return <div className="empty-state">Carregando…</div>

  return (
    <div>
      <div className="field" style={{ maxWidth: 260, marginBottom: 20 }}>
        <label>Setor</label>
        <select value={filtro} onChange={(e) => setFiltro(e.target.value as EstoqueCategoria | 'Todos')}>
          {admin && <option value="Todos">Todos</option>}
          {setores.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <EstoqueItemList itens={itensFiltrados} showSetor={filtro === 'Todos'} podeAjustar={admin} />
    </div>
  )
}
