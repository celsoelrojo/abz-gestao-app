import { useMemo, useState } from 'react'
import { isFullAdmin, useAuthStore } from '../../store/authStore'
import { visibleCategorias } from './estoqueAccess'
import { categoriasPresentes, filtrarPorCategoria } from './estoqueHelpers'
import { CategoriaFiltroSelect } from './CategoriaFiltroSelect'
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
  const [filtroCategoria, setFiltroCategoria] = useState('Todas')

  // Itens no escopo do usuário + setor escolhido (sem o filtro de categoria
  // ainda) — é dessa lista que saem as opções de categoria.
  const escopoSetor = useMemo(() => {
    const escopo = (itens ?? []).filter((it) => setores.includes(it.categoria))
    return filtro === 'Todos' ? escopo : escopo.filter((it) => it.categoria === filtro)
  }, [itens, setores, filtro])

  const categoriaOptions = useMemo(() => categoriasPresentes(escopoSetor), [escopoSetor])
  const temSemCategoria = useMemo(() => escopoSetor.some((it) => !it.produto_categoria), [escopoSetor])

  const itensFiltrados = useMemo(
    () => filtrarPorCategoria(escopoSetor, filtroCategoria),
    [escopoSetor, filtroCategoria],
  )

  if (isLoading) return <div className="empty-state">Carregando…</div>

  return (
    <div>
      <div className="field-row" style={{ marginBottom: 20 }}>
        <div className="field" style={{ maxWidth: 240 }}>
          <label>Setor</label>
          <select
            value={filtro}
            onChange={(e) => {
              setFiltro(e.target.value as EstoqueCategoria | 'Todos')
              setFiltroCategoria('Todas')
            }}
          >
            {admin && <option value="Todos">Todos</option>}
            {setores.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <CategoriaFiltroSelect
          value={filtroCategoria}
          onChange={setFiltroCategoria}
          categorias={categoriaOptions}
          temSemCategoria={temSemCategoria}
          style={{ maxWidth: 240 }}
        />
      </div>

      <EstoqueItemList itens={itensFiltrados} showSetor={filtro === 'Todos'} podeAjustar={admin} />
    </div>
  )
}
