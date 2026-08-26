import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { RESERVA_CAPACIDADE_KEY, useReservaCapacidade } from './useReservas'
import type { ReservaPeriodo } from '../../types/database'

export function ReservaCapacidadeModal({ onClose }: { onClose: () => void }) {
  const { data: capacidades, isLoading } = useReservaCapacidade()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState<ReservaPeriodo | null>(null)

  async function handleSave(periodo: ReservaPeriodo, valor: string) {
    const capacidade = Number(valor)
    if (!(capacidade >= 0)) return
    setSaving(periodo)
    try {
      const { error } = await supabase.from('reserva_capacidade').update({ capacidade }).eq('periodo', periodo)
      if (error) {
        window.alert(error.message)
        return
      }
      await queryClient.invalidateQueries({ queryKey: RESERVA_CAPACIDADE_KEY })
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>Capacidade de Reservas</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          {isLoading && <div className="empty-state">Carregando…</div>}
          {capacidades?.map((c) => (
            <CapacidadeRow key={c.periodo} periodo={c.periodo} valorAtual={c.capacidade} saving={saving === c.periodo} onSave={handleSave} />
          ))}
          <p className="field-hint">
            Ultrapassar a capacidade não bloqueia uma nova reserva — só avisa e pede confirmação antes de salvar.
          </p>
        </div>
      </div>
    </div>
  )
}

function CapacidadeRow({
  periodo,
  valorAtual,
  saving,
  onSave,
}: {
  periodo: ReservaPeriodo
  valorAtual: number
  saving: boolean
  onSave: (periodo: ReservaPeriodo, valor: string) => void
}) {
  const [valor, setValor] = useState(String(valorAtual))
  const dirty = valor !== String(valorAtual)

  return (
    <div className="field-row" style={{ alignItems: 'flex-end' }}>
      <div className="field">
        <label>{periodo}</label>
        <input type="number" min="0" value={valor} onChange={(e) => setValor(e.target.value)} />
      </div>
      <button className="btn btn-primary" disabled={!dirty || saving} onClick={() => onSave(periodo, valor)}>
        {saving ? 'Salvando...' : 'Salvar'}
      </button>
    </div>
  )
}
