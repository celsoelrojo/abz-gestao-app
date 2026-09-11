import { useMemo, useState } from 'react'
import { isFullAdmin, useAuthStore } from '../../store/authStore'
import { FICHA_SETORES } from './fichaConstants'
import { useFichasProducao } from './useFichasProducao'
import { FichaProducaoDetailModal } from './FichaProducaoDetailModal'
import type { FichaProducaoRow, Setor } from '../../types/database'

// Consulta de receitas publicadas — RLS já entrega só o que o usuário pode
// ver (Bar vê as do Bar, Cozinha as da Cozinha, Administrador vê as duas);
// o filtro de setor aqui é só reforço visual, não é o que protege o dado.
export function FichasProducaoConsultaTab() {
  const profile = useAuthStore((s) => s.profile)
  const admin = isFullAdmin(profile)
  const { data, isLoading } = useFichasProducao()

  const profileSetor = profile?.setor
  const visibleSetores: Setor[] = useMemo(
    () =>
      admin
        ? [...FICHA_SETORES]
        : profileSetor && FICHA_SETORES.includes(profileSetor as (typeof FICHA_SETORES)[number])
          ? [profileSetor]
          : [],
    [admin, profileSetor],
  )

  const [busca, setBusca] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todas')
  const [detalhe, setDetalhe] = useState<FichaProducaoRow | null>(null)

  const categorias = useMemo(() => {
    const set = new Set<string>()
    ;(data ?? []).forEach((f) => f.categoria && set.add(f.categoria))
    return ['Todas', ...Array.from(set).sort()]
  }, [data])

  const publicadas = useMemo(
    () =>
      (data ?? [])
        .filter((f) => f.status === 'publicada' && visibleSetores.includes(f.setor as Setor))
        .filter((f) => categoriaFiltro === 'Todas' || f.categoria === categoriaFiltro)
        .filter((f) => !busca.trim() || f.nome.toLowerCase().includes(busca.trim().toLowerCase()))
        .sort((a, b) => a.nome.localeCompare(b.nome)),
    [data, visibleSetores, categoriaFiltro, busca],
  )

  return (
    <div>
      <div className="field-row" style={{ marginBottom: 16 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Buscar</label>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome da ficha..." />
        </div>
        <div className="field">
          <label>Categoria</label>
          <select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)}>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading && <div className="empty-state">Carregando…</div>}
      <div className="producao-grid">
        {publicadas.length === 0 && !isLoading && <div className="empty-state">Nenhuma ficha de produção encontrada.</div>}
        {publicadas.map((f) => (
          <button className="producao-card" key={f.id} onClick={() => setDetalhe(f)}>
            <span className="producao-card-nome">{f.nome}</span>
            <div className="producao-card-meta">
              <span className="badge-status badge-status-ativa">{f.setor}</span>
              {f.categoria && <span className="badge-status badge-status-pendente">{f.categoria}</span>}
            </div>
          </button>
        ))}
      </div>

      {detalhe && <FichaProducaoDetailModal key={detalhe.id} ficha={detalhe} onClose={() => setDetalhe(null)} />}
    </div>
  )
}
