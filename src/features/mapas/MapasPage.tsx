import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isFullAdmin, isManager, useAuthStore } from '../../store/authStore'
import { confirmar } from '../../store/confirmStore'
import { supabase } from '../../lib/supabaseClient'
import { MAPAS_KEY, useMapasFluxogramas, useMapasRealtime } from './useMapas'
import { MapaFormModal } from './MapaFormModal'
import { MapaDetailModal } from './MapaDetailModal'
import type { MapaFluxogramaRow, Setor } from '../../types/database'

const SETORES: Setor[] = ['Bar', 'Cozinha', 'Salão']

export function MapasPage() {
  const profile = useAuthStore((s) => s.profile)
  const queryClient = useQueryClient()
  const admin = isFullAdmin(profile)

  useMapasRealtime()
  const { data, isLoading } = useMapasFluxogramas()

  const [tab, setTab] = useState<'mapa' | 'fluxograma'>('mapa')
  const [setorFiltro, setSetorFiltro] = useState<'Todos' | Setor>(admin ? 'Todos' : (profile?.setor as Setor) ?? 'Bar')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<MapaFluxogramaRow | null>(null)
  const [detalhe, setDetalhe] = useState<MapaFluxogramaRow | null>(null)

  const itensDoTipo = useMemo(() => (data ?? []).filter((m) => m.kind === tab), [data, tab])
  const itensVisiveis = useMemo(
    () => (admin && setorFiltro !== 'Todos' ? itensDoTipo.filter((m) => m.setor === setorFiltro) : itensDoTipo),
    [itensDoTipo, admin, setorFiltro],
  )

  const canManageAqui = isManager(profile, admin && setorFiltro !== 'Todos' ? setorFiltro : (profile?.setor ?? undefined))

  async function refetch() {
    await queryClient.invalidateQueries({ queryKey: MAPAS_KEY })
  }

  async function excluir(m: MapaFluxogramaRow) {
    if (!(await confirmar(`Excluir "${m.title}"? Todos os blocos junto serão apagados. Esta ação não pode ser desfeita.`))) return
    const { error } = await supabase.from('mapas_fluxogramas').delete().eq('id', m.id)
    if (error) {
      window.alert(error.message)
      return
    }
    await refetch()
  }

  return (
    <div className="container">
      <div className="checklist-header">
        <div>
          <h2 className="page-title">Mapas e Fluxogramas</h2>
          <p className="page-subtitle">Layout do ambiente e fluxos de processo por setor</p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button className={`btn ${tab === 'mapa' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('mapa')}>
            Mapas
          </button>
          <button className={`btn ${tab === 'fluxograma' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('fluxograma')}>
            Fluxogramas
          </button>
        </div>
      </div>

      {admin && (
        <div className="field" style={{ maxWidth: 220, marginBottom: 16 }}>
          <label>Setor</label>
          <select value={setorFiltro} onChange={(e) => setSetorFiltro(e.target.value as 'Todos' | Setor)}>
            <option value="Todos">Todos</option>
            {SETORES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      {canManageAqui && (
        <button className="btn btn-primary" style={{ marginBottom: 16 }} onClick={() => setCreating(true)}>
          + Adicionar {tab === 'mapa' ? 'Mapa' : 'Fluxograma'}
        </button>
      )}

      {isLoading && <div className="empty-state">Carregando…</div>}
      <div className="manage-list">
        {itensVisiveis.length === 0 && !isLoading && (
          <div className="empty-state">Nenhum {tab === 'mapa' ? 'mapa' : 'fluxograma'} cadastrado.</div>
        )}
        {itensVisiveis.map((m) => (
          <div className="manage-row" key={m.id}>
            <button
              className="manage-row-info"
              onClick={() => setDetalhe(m)}
              style={{ textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <strong>{m.title}</strong>
              {admin && <span>{m.setor}</span>}
            </button>
            <div className="manage-row-actions">
              {isManager(profile, m.setor) && (
                <button className="icon-btn" onClick={() => setEditing(m)} title="Editar">
                  ✎
                </button>
              )}
              {admin && (
                <button className="icon-btn danger" onClick={() => excluir(m)} title="Excluir">
                  🗑
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {(creating || editing) && (
        <MapaFormModal
          kind={tab}
          mapa={editing}
          defaultSetor={admin ? (setorFiltro !== 'Todos' ? setorFiltro : 'Bar') : ((profile?.setor as Setor) ?? 'Bar')}
          lockedSetor={admin ? null : ((profile?.setor as Setor) ?? null)}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={async () => {
            setCreating(false)
            setEditing(null)
            await refetch()
          }}
        />
      )}

      {detalhe && <MapaDetailModal key={detalhe.id} mapa={detalhe} onClose={() => setDetalhe(null)} />}
    </div>
  )
}
