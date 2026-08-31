import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isFullAdmin, isManager, useAuthStore } from '../../store/authStore'
import { confirmar } from '../../store/confirmStore'
import { supabase } from '../../lib/supabaseClient'
import { POP_SETORES, type PopSetor } from './popConstants'
import { POPS_KEY, usePopCategories, usePops, usePopsRealtime } from './usePops'
import { PopFormModal } from './PopFormModal'
import { PopDetailModal } from './PopDetailModal'
import { ManagePopCategoriesModal } from './ManagePopCategoriesModal'
import type { PopRow, ProfileRow } from '../../types/database'

function canManageSetor(profile: ProfileRow | null, setor: PopSetor): boolean {
  if (setor === 'Geral') return isFullAdmin(profile)
  return isManager(profile, setor)
}

export function PopsPage() {
  const profile = useAuthStore((s) => s.profile)
  const queryClient = useQueryClient()
  const admin = isFullAdmin(profile)

  usePopsRealtime()
  const { data, isLoading } = usePops()
  const { data: categories } = usePopCategories()

  const visibleSetores: PopSetor[] = useMemo(() => {
    if (admin) return [...POP_SETORES]
    if (profile?.setor) return [profile.setor as PopSetor, 'Geral']
    return []
  }, [admin, profile?.setor])

  const canManageAlgumSetor = POP_SETORES.some((s) => canManageSetor(profile, s))

  const [modo, setModo] = useState<'consultar' | 'gerenciar'>('consultar')
  const [busca, setBusca] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todas')
  const [detalhe, setDetalhe] = useState<PopRow | null>(null)
  const [editing, setEditing] = useState<PopRow | null>(null)
  const [creating, setCreating] = useState<PopSetor | null>(null)
  const [managingCategorias, setManagingCategorias] = useState(false)

  const categoriaNome = useMemo(() => {
    const map = new Map<string, string>()
    ;(categories ?? []).forEach((c) => map.set(c.id, c.name))
    return map
  }, [categories])

  const publicadas = useMemo(
    () =>
      (data ?? [])
        .filter((p) => p.status === 'publicada' && visibleSetores.includes(p.setor as PopSetor))
        .filter((p) => categoriaFiltro === 'Todas' || categoriaNome.get(p.category_id ?? '') === categoriaFiltro)
        .filter((p) => !busca.trim() || p.titulo.toLowerCase().includes(busca.trim().toLowerCase()))
        .sort((a, b) => a.titulo.localeCompare(b.titulo)),
    [data, visibleSetores, categoriaFiltro, busca, categoriaNome],
  )

  const bySetorGerenciar = useMemo(() => {
    const map = new Map<PopSetor, PopRow[]>()
    POP_SETORES.filter((s) => canManageSetor(profile, s)).forEach((s) => map.set(s, []))
    ;(data ?? []).filter((p) => map.has(p.setor as PopSetor)).forEach((p) => map.get(p.setor as PopSetor)!.push(p))
    return map
  }, [data, profile])

  async function refetch() {
    await queryClient.invalidateQueries({ queryKey: POPS_KEY })
  }

  async function togglePublicacao(p: PopRow) {
    if (p.status === 'rascunho') {
      window.alert('Um POP em rascunho só pode ser publicado pelo formulário de edição.')
      return
    }
    const novoStatus = p.status === 'publicada' ? 'inativa' : 'publicada'
    const patch: Partial<PopRow> = { status: novoStatus }
    if (novoStatus === 'publicada') {
      patch.publicado_por = profile?.nome ?? null
      patch.publicado_em = new Date().toISOString()
      patch.historico = [...p.historico, { data: new Date().toISOString(), tipo: 'publicacao', autor: profile?.nome ?? 'Desconhecido' }]
    }
    const { error } = await supabase.from('pops').update(patch).eq('id', p.id)
    if (error) {
      window.alert(error.message)
      return
    }
    await refetch()
  }

  async function excluir(p: PopRow) {
    if (!(await confirmar(`Excluir o POP "${p.titulo}"? Esta ação não pode ser desfeita.`))) return
    const { error } = await supabase.from('pops').delete().eq('id', p.id)
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
          <h2 className="page-title">POP's</h2>
          <p className="page-subtitle">Procedimentos Operacionais Padrão</p>
        </div>
        {canManageAlgumSetor && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button className={`btn ${modo === 'consultar' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setModo('consultar')}>
              Consultar
            </button>
            <button className={`btn ${modo === 'gerenciar' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setModo('gerenciar')}>
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
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Título do POP..." />
            </div>
            <div className="field">
              <label>Categoria</label>
              <select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)}>
                <option value="Todas">Todas</option>
                {(categories ?? []).map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isLoading && <div className="empty-state">Carregando…</div>}
          <div className="manage-list">
            {publicadas.length === 0 && !isLoading && <div className="empty-state">Nenhum POP encontrado.</div>}
            {publicadas.map((p) => (
              <button className="manage-row" key={p.id} onClick={() => setDetalhe(p)} style={{ textAlign: 'left', width: '100%' }}>
                <div className="manage-row-info">
                  <strong>{p.titulo}</strong>
                  <span>
                    {p.setor}
                    {p.category_id ? ` · ${categoriaNome.get(p.category_id) ?? ''}` : ''}
                    {p.subcategoria ? ` · ${p.subcategoria}` : ''}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {modo === 'gerenciar' && canManageAlgumSetor && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => setCreating(admin ? 'Bar' : ((profile?.setor as PopSetor) ?? 'Bar'))}>
              + Novo POP
            </button>
            {admin && (
              <button className="btn btn-ghost" onClick={() => setManagingCategorias(true)}>
                Gerenciar Categorias
              </button>
            )}
          </div>
          {[...bySetorGerenciar.entries()].map(([setor, setorPops]) => (
            <div key={setor} style={{ marginBottom: 20 }}>
              <h4 className="section-label">{setor}</h4>
              <div className="manage-list">
                {setorPops.length === 0 && <div className="empty-state">Nenhum POP cadastrado.</div>}
                {setorPops.map((p) => (
                  <div className="manage-row" key={p.id}>
                    <div className="manage-row-info">
                      <strong>{p.titulo}</strong>
                      <span>
                        {p.category_id ? categoriaNome.get(p.category_id) ?? '—' : '—'} · versão {p.versao}
                      </span>
                      <div className="account-badges">
                        <span
                          className={`badge-status ${
                            p.status === 'publicada' ? 'badge-status-ativa' : p.status === 'rascunho' ? 'badge-status-pendente' : 'badge-status-bloqueada'
                          }`}
                        >
                          {p.status}
                        </span>
                      </div>
                    </div>
                    <div className="manage-row-actions">
                      <button className="icon-btn" onClick={() => setDetalhe(p)} title="Ver">
                        👁
                      </button>
                      <button className="icon-btn" onClick={() => setEditing(p)} title="Editar">
                        ✎
                      </button>
                      {p.status !== 'rascunho' && (
                        <button
                          className="icon-btn"
                          onClick={() => togglePublicacao(p)}
                          title={p.status === 'publicada' ? 'Inativar' : 'Reativar'}
                        >
                          {p.status === 'publicada' ? '🚫' : '✓'}
                        </button>
                      )}
                      {admin && (
                        <button className="icon-btn danger" onClick={() => excluir(p)} title="Excluir">
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

      {detalhe && <PopDetailModal key={detalhe.id} pop={detalhe} onClose={() => setDetalhe(null)} />}

      {(creating || editing) && (
        <PopFormModal
          pop={editing}
          defaultSetor={creating ?? (editing?.setor as PopSetor) ?? 'Bar'}
          lockedSetor={admin ? null : ((profile?.setor as PopSetor) ?? null)}
          onClose={() => {
            setCreating(null)
            setEditing(null)
          }}
          onSaved={async () => {
            setCreating(null)
            setEditing(null)
            await refetch()
          }}
        />
      )}

      {managingCategorias && <ManagePopCategoriesModal onClose={() => setManagingCategorias(false)} />}
    </div>
  )
}
