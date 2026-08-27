import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { FREELANCERS_KEY, useFreelancers } from './useFreelancers'
import { FreelancerFormModal } from './FreelancerFormModal'
import type { FreelancerRow, Setor } from '../../types/database'

const SETORES: Setor[] = ['Bar', 'Cozinha', 'Salão']

export function FreelancerCadastroTab() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useFreelancers()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<FreelancerRow | null>(null)

  const bySetor = useMemo(() => {
    const map = new Map<Setor, FreelancerRow[]>()
    SETORES.forEach((s) => map.set(s, []))
    ;(data ?? [])
      .slice()
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .forEach((f) => map.get(f.setor)?.push(f))
    return map
  }, [data])

  async function refetch() {
    await queryClient.invalidateQueries({ queryKey: FREELANCERS_KEY })
  }

  async function toggleStatus(f: FreelancerRow) {
    const { error } = await supabase
      .from('freelancers')
      .update({ status: f.status === 'ativo' ? 'inativo' : 'ativo' })
      .eq('id', f.id)
    if (error) {
      window.alert(error.message)
      return
    }
    await refetch()
  }

  return (
    <div>
      <button className="btn btn-primary" style={{ marginBottom: 16 }} onClick={() => setCreating(true)}>
        + Novo Freelancer
      </button>

      {isLoading && <div className="empty-state">Carregando…</div>}
      {[...bySetor.entries()].map(([setor, freelancers]) => (
        <div key={setor} style={{ marginBottom: 20 }}>
          <h4 className="section-label">{setor}</h4>
          <div className="manage-list">
            {freelancers.length === 0 && <div className="empty-state">Nenhum freelancer cadastrado.</div>}
            {freelancers.map((f) => (
              <div className={`manage-row ${f.status === 'inativo' ? 'inactive' : ''}`} key={f.id}>
                <div className="manage-row-info">
                  <strong>{f.nome}</strong>
                  <span>
                    {f.funcao} · {f.telefone}
                    {!f.email ? '' : ` · ${f.email}`}
                    {f.status === 'inativo' ? ' · inativo' : ''}
                  </span>
                </div>
                <div className="manage-row-actions">
                  <button className="icon-btn" onClick={() => toggleStatus(f)} title={f.status === 'ativo' ? 'Inativar' : 'Ativar'}>
                    {f.status === 'ativo' ? '👁' : '🚫'}
                  </button>
                  <button className="icon-btn" onClick={() => setEditing(f)} title="Editar">
                    ✎
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {(creating || editing) && (
        <FreelancerFormModal
          freelancer={editing}
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
