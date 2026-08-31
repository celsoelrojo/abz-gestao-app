import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { confirmar } from '../../store/confirmStore'
import { POP_CATEGORIES_KEY, POPS_KEY, usePopCategories, usePops } from './usePops'
import type { PopCategoryRow } from '../../types/database'

export function ManagePopCategoriesModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const { data: categories } = usePopCategories()
  const { data: pops } = usePops()

  const [editing, setEditing] = useState<PopCategoryRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [nome, setNome] = useState('')
  const [reassigning, setReassigning] = useState<PopCategoryRow | null>(null)
  const [reassignTargetId, setReassignTargetId] = useState('')

  const contagemPorCategoria = useMemo(() => {
    const map = new Map<string, number>()
    ;(pops ?? []).forEach((p) => {
      if (p.category_id) map.set(p.category_id, (map.get(p.category_id) ?? 0) + 1)
    })
    return map
  }, [pops])

  async function refetch() {
    await queryClient.invalidateQueries({ queryKey: POP_CATEGORIES_KEY })
  }

  async function move(index: number, direction: 'up' | 'down') {
    const list = categories ?? []
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    const a = list[index]
    const b = list[swapIndex]
    if (!a || !b) return
    await supabase.from('pop_categories').update({ ordem: b.ordem }).eq('id', a.id)
    await supabase.from('pop_categories').update({ ordem: a.ordem }).eq('id', b.id)
    await refetch()
  }

  function startCreate() {
    setNome('')
    setCreating(true)
  }

  function startEdit(c: PopCategoryRow) {
    setNome(c.name)
    setEditing(c)
  }

  async function submitNome() {
    if (!nome.trim()) return
    if (editing) {
      await supabase.from('pop_categories').update({ name: nome.trim() }).eq('id', editing.id)
    } else {
      const maxOrdem = (categories ?? []).reduce((max, c) => Math.max(max, c.ordem), -1)
      await supabase.from('pop_categories').insert({ name: nome.trim(), ordem: maxOrdem + 1 })
    }
    setEditing(null)
    setCreating(false)
    await refetch()
    await queryClient.invalidateQueries({ queryKey: POPS_KEY })
  }

  async function requestDelete(c: PopCategoryRow) {
    if ((categories ?? []).length <= 1) {
      window.alert('Não é possível excluir a última categoria.')
      return
    }
    if ((contagemPorCategoria.get(c.id) ?? 0) > 0) {
      setReassignTargetId('')
      setReassigning(c)
      return
    }
    if (!(await confirmar(`Excluir a categoria "${c.name}"?`))) return
    supabase
      .from('pop_categories')
      .delete()
      .eq('id', c.id)
      .then(async ({ error }) => {
        if (error) {
          window.alert(error.message)
          return
        }
        await refetch()
      })
  }

  async function confirmReassignAndDelete() {
    if (!reassigning || !reassignTargetId) return
    const { error: updateError } = await supabase
      .from('pops')
      .update({ category_id: reassignTargetId })
      .eq('category_id', reassigning.id)
    if (updateError) {
      window.alert(updateError.message)
      return
    }
    const { error: deleteError } = await supabase.from('pop_categories').delete().eq('id', reassigning.id)
    if (deleteError) {
      window.alert(deleteError.message)
      return
    }
    setReassigning(null)
    await refetch()
    await queryClient.invalidateQueries({ queryKey: POPS_KEY })
  }

  const list = categories ?? []

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>Gerenciar Categorias de POP</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <button className="btn btn-primary" style={{ marginBottom: 16 }} onClick={startCreate}>
            + Adicionar categoria
          </button>

          {(creating || editing) && (
            <div className="field-row" style={{ marginBottom: 16 }}>
              <div className="field" style={{ flex: 1 }}>
                <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da categoria" autoFocus />
              </div>
              <button className="btn btn-primary" onClick={submitNome} disabled={!nome.trim()}>
                Salvar
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setEditing(null)
                  setCreating(false)
                }}
              >
                Cancelar
              </button>
            </div>
          )}

          {reassigning && (
            <div className="pop-alert-box" style={{ marginBottom: 16 }}>
              <p>
                "{reassigning.name}" tem {contagemPorCategoria.get(reassigning.id)} POP(s). Escolha para qual categoria movê-los antes de
                excluir.
              </p>
              <div className="field-row">
                <select value={reassignTargetId} onChange={(e) => setReassignTargetId(e.target.value)}>
                  <option value="">Selecione...</option>
                  {list
                    .filter((c) => c.id !== reassigning.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
                <button className="btn btn-primary" disabled={!reassignTargetId} onClick={confirmReassignAndDelete}>
                  Mover e excluir
                </button>
                <button className="btn btn-ghost" onClick={() => setReassigning(null)}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="manage-list">
            {list.map((c, idx) => (
              <div className="manage-row" key={c.id}>
                <div className="manage-row-info">
                  <strong>{c.name}</strong>
                  <span>{contagemPorCategoria.get(c.id) ?? 0} POP(s)</span>
                </div>
                <div className="manage-row-actions">
                  <button className="icon-btn" disabled={idx === 0} onClick={() => move(idx, 'up')} title="Mover para cima">
                    ↑
                  </button>
                  <button className="icon-btn" disabled={idx === list.length - 1} onClick={() => move(idx, 'down')} title="Mover para baixo">
                    ↓
                  </button>
                  <button className="icon-btn" onClick={() => startEdit(c)} title="Editar">
                    ✎
                  </button>
                  <button className="icon-btn danger" onClick={() => requestDelete(c)} title="Excluir">
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose}>
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
