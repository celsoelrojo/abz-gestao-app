import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { MapaFluxogramaRow, Setor } from '../../types/database'

const SETORES: Setor[] = ['Bar', 'Cozinha', 'Salão']

export function MapaFormModal({
  kind,
  mapa,
  defaultSetor,
  lockedSetor,
  onClose,
  onSaved,
}: {
  kind: 'mapa' | 'fluxograma'
  mapa: MapaFluxogramaRow | null
  defaultSetor: Setor
  lockedSetor: Setor | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const isEdit = !!mapa
  const [title, setTitle] = useState(mapa?.title ?? '')
  const [setor, setSetor] = useState<Setor>(mapa?.setor ?? lockedSetor ?? defaultSetor)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const isValid = !!title.trim()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isValid) return
    setError(null)
    setSubmitting(true)
    try {
      if (mapa) {
        const { error: updateError } = await supabase
          .from('mapas_fluxogramas')
          .update({ title: title.trim(), setor })
          .eq('id', mapa.id)
        if (updateError) {
          setError(updateError.message)
          return
        }
      } else {
        const { error: insertError } = await supabase.from('mapas_fluxogramas').insert({ kind, title: title.trim(), setor, ordem: 0 })
        if (insertError) {
          setError(insertError.message)
          return
        }
      }
      await onSaved()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>
            {isEdit ? 'Editar' : 'Novo'} {kind === 'mapa' ? 'Mapa' : 'Fluxograma'}
          </h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="field">
            <label>Título *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="field">
            <label>Setor *</label>
            <select value={setor} onChange={(e) => setSetor(e.target.value as Setor)} disabled={!!lockedSetor}>
              {SETORES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="login-error">{error}</p>}

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={!isValid || submitting}>
              {submitting ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
