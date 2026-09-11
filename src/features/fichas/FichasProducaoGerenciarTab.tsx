import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isFullAdmin, useAuthStore } from '../../store/authStore'
import { confirmar } from '../../store/confirmStore'
import { supabase } from '../../lib/supabaseClient'
import { FICHA_SETORES } from './fichaConstants'
import { FICHAS_PRODUCAO_KEY, useFichasProducao } from './useFichasProducao'
import { FichaProducaoFormModal } from './FichaProducaoFormModal'
import { FichaProducaoDetailModal } from './FichaProducaoDetailModal'
import type { FichaProducaoRow, Setor } from '../../types/database'

// Cadastro/edição/publicação das fichas — RLS já restringe a escrita a
// Administrador ou Gestor do próprio setor; quem chega aqui via o hub
// (managerOnly no FichasProducaoPage) sempre tem uma dessas duas permissões.
export function FichasProducaoGerenciarTab() {
  const profile = useAuthStore((s) => s.profile)
  const queryClient = useQueryClient()
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

  const [detalhe, setDetalhe] = useState<FichaProducaoRow | null>(null)
  const [editing, setEditing] = useState<FichaProducaoRow | null>(null)
  const [creating, setCreating] = useState(false)

  const bySetor = useMemo(() => {
    const map = new Map<Setor, FichaProducaoRow[]>()
    visibleSetores.forEach((s) => map.set(s, []))
    ;(data ?? []).filter((f) => visibleSetores.includes(f.setor as Setor)).forEach((f) => map.get(f.setor as Setor)!.push(f))
    return map
  }, [data, visibleSetores])

  async function refetch() {
    await queryClient.invalidateQueries({ queryKey: FICHAS_PRODUCAO_KEY })
  }

  async function togglePublicacao(f: FichaProducaoRow) {
    if (f.status === 'rascunho') {
      window.alert('Uma ficha em rascunho só pode ser publicada pelo formulário de edição.')
      return
    }
    const novoStatus = f.status === 'publicada' ? 'inativa' : 'publicada'
    const patch: Partial<FichaProducaoRow> = { status: novoStatus }
    if (novoStatus === 'publicada') {
      patch.publicado_por = profile?.nome ?? null
      patch.publicado_em = new Date().toISOString()
      patch.historico = [...f.historico, { data: new Date().toISOString(), tipo: 'publicacao', autor: profile?.nome ?? 'Desconhecido' }]
    }
    const { error } = await supabase.from('fichas_producao').update(patch).eq('id', f.id)
    if (error) {
      window.alert(error.message)
      return
    }
    await refetch()
  }

  async function excluir(f: FichaProducaoRow) {
    if (!(await confirmar(`Excluir a ficha de produção "${f.nome}"? Esta ação não pode ser desfeita.`))) return
    const { error } = await supabase.from('fichas_producao').delete().eq('id', f.id)
    if (error) {
      window.alert(error.message)
      return
    }
    await refetch()
  }

  return (
    <div>
      <button className="btn btn-primary" style={{ marginBottom: 16 }} onClick={() => setCreating(true)}>
        + Nova ficha de produção
      </button>
      {isLoading && <div className="empty-state">Carregando…</div>}
      {!isLoading &&
        [...bySetor.entries()].map(([setor, setorFichas]) => (
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
                    <button className="icon-btn" onClick={() => setEditing(f)} title="Editar">
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

      {detalhe && <FichaProducaoDetailModal key={detalhe.id} ficha={detalhe} onClose={() => setDetalhe(null)} />}

      {(creating || editing) && (
        <FichaProducaoFormModal
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
