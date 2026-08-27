import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isFullAdmin, isManager, useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabaseClient'
import { FICHA_SETORES } from './fichaConstants'
import { FICHAS_TECNICAS_KEY, useFichasTecnicas, useFichasTecnicasRealtime } from './useFichasTecnicas'
import { FichaTecnicaFormModal } from './FichaTecnicaFormModal'
import { FichaTecnicaDetailModal } from './FichaTecnicaDetailModal'
import type { FichaTecnicaRow, Setor } from '../../types/database'

export function FichasTecnicasPage() {
  const profile = useAuthStore((s) => s.profile)
  const queryClient = useQueryClient()
  const admin = isFullAdmin(profile)
  const canManage = isManager(profile, undefined)

  useFichasTecnicasRealtime()
  const { data, isLoading } = useFichasTecnicas()

  const profileSetor = profile?.setor
  const visibleSetores: Setor[] = useMemo(
    () => (admin ? [...FICHA_SETORES] : profileSetor && FICHA_SETORES.includes(profileSetor as (typeof FICHA_SETORES)[number]) ? [profileSetor] : []),
    [admin, profileSetor],
  )

  const [modo, setModo] = useState<'consultar' | 'gerenciar'>('consultar')
  const [busca, setBusca] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todas')
  const [detalhe, setDetalhe] = useState<FichaTecnicaRow | null>(null)
  const [editing, setEditing] = useState<FichaTecnicaRow | null>(null)
  const [creating, setCreating] = useState(false)

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

  const bySetorGerenciar = useMemo(() => {
    const map = new Map<Setor, FichaTecnicaRow[]>()
    visibleSetores.forEach((s) => map.set(s, []))
    ;(data ?? []).filter((f) => visibleSetores.includes(f.setor as Setor)).forEach((f) => map.get(f.setor as Setor)!.push(f))
    return map
  }, [data, visibleSetores])

  async function refetch() {
    await queryClient.invalidateQueries({ queryKey: FICHAS_TECNICAS_KEY })
  }

  async function togglePublicacao(f: FichaTecnicaRow) {
    if (f.status === 'rascunho') {
      window.alert('Uma ficha em rascunho só pode ser publicada pelo formulário de edição.')
      return
    }
    const novoStatus = f.status === 'publicada' ? 'inativa' : 'publicada'
    const patch: Partial<FichaTecnicaRow> = { status: novoStatus }
    if (novoStatus === 'publicada') {
      patch.publicado_por = profile?.nome ?? null
      patch.publicado_em = new Date().toISOString()
    }
    const { error } = await supabase.from('fichas_tecnicas').update(patch).eq('id', f.id)
    if (error) {
      window.alert(error.message)
      return
    }
    await refetch()
  }

  async function excluir(f: FichaTecnicaRow) {
    if (!window.confirm(`Excluir a ficha técnica "${f.nome}"? Esta ação não pode ser desfeita.`)) return
    const { error } = await supabase.from('fichas_tecnicas').delete().eq('id', f.id)
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
          <h2 className="page-title">Fichas Técnicas</h2>
          <p className="page-subtitle">Consulte receitas publicadas ou gerencie as fichas do seu setor</p>
        </div>
        {canManage && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              className={`btn ${modo === 'consultar' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setModo('consultar')}
            >
              Consultar
            </button>
            <button
              className={`btn ${modo === 'gerenciar' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setModo('gerenciar')}
            >
              Gerenciar
            </button>
          </div>
        )}
      </div>

      {modo === 'consultar' && (
        <>
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
          <div className="manage-list">
            {publicadas.length === 0 && !isLoading && <div className="empty-state">Nenhuma ficha técnica encontrada.</div>}
            {publicadas.map((f) => (
              <button className="manage-row" key={f.id} onClick={() => setDetalhe(f)} style={{ textAlign: 'left', width: '100%' }}>
                <div className="manage-row-info">
                  <strong>{f.nome}</strong>
                  <span>
                    {f.setor}
                    {f.categoria ? ` · ${f.categoria}` : ''}
                    {f.subcategoria ? ` · ${f.subcategoria}` : ''}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {modo === 'gerenciar' && canManage && (
        <>
          <button className="btn btn-primary" style={{ marginBottom: 16 }} onClick={() => setCreating(true)}>
            + Nova ficha técnica
          </button>
          {[...bySetorGerenciar.entries()].map(([setor, setorFichas]) => (
            <div key={setor} style={{ marginBottom: 20 }}>
              <h4 className="section-label">{setor}</h4>
              <div className="manage-list">
                {setorFichas.length === 0 && <div className="empty-state">Nenhuma ficha cadastrada.</div>}
                {setorFichas.map((f) => (
                  <div className="manage-row" key={f.id}>
                    <div className="manage-row-info">
                      <strong>{f.nome}</strong>
                      <span>
                        {f.categoria ?? '—'} · versão {f.versao}
                      </span>
                      <div className="account-badges">
                        <span
                          className={`badge-status ${
                            f.status === 'publicada'
                              ? 'badge-status-ativa'
                              : f.status === 'rascunho'
                                ? 'badge-status-pendente'
                                : 'badge-status-bloqueada'
                          }`}
                        >
                          {f.status}
                        </span>
                      </div>
                    </div>
                    <div className="manage-row-actions">
                      <button className="icon-btn" onClick={() => setDetalhe(f)} title="Ver">
                        👁
                      </button>
                      <button className="icon-btn" onClick={() => setEditing(f as FichaTecnicaRow)} title="Editar">
                        ✎
                      </button>
                      {f.status !== 'rascunho' && (
                        <button
                          className="icon-btn"
                          onClick={() => togglePublicacao(f)}
                          title={f.status === 'publicada' ? 'Inativar' : 'Reativar'}
                        >
                          {f.status === 'publicada' ? '🚫' : '✓'}
                        </button>
                      )}
                      {admin && (
                        <button className="icon-btn danger" onClick={() => excluir(f)} title="Excluir">
                          🗑
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {detalhe && <FichaTecnicaDetailModal key={detalhe.id} ficha={detalhe} onClose={() => setDetalhe(null)} />}

      {(creating || editing) && (
        <FichaTecnicaFormModal
          ficha={editing}
          defaultSetor={admin ? 'Bar' : ((profile?.setor as 'Bar' | 'Cozinha') ?? 'Bar')}
          lockedSetor={admin ? null : ((profile?.setor as 'Bar' | 'Cozinha') ?? null)}
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
    </div>
  )
}
