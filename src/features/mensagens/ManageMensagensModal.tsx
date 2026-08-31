import { useMemo, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isFullAdmin, isSetorManager, useAuthStore } from '../../store/authStore'
import { confirmar } from '../../store/confirmStore'
import { supabase } from '../../lib/supabaseClient'
import { MENSAGENS_KEY, useMensagens } from './useMensagens'
import type { MensagemDestino, MensagemRow } from '../../types/database'

const DESTINOS: MensagemDestino[] = ['Bar', 'Cozinha', 'Salão', 'Todos']

export function ManageMensagensModal({ onClose }: { onClose: () => void }) {
  const profile = useAuthStore((s) => s.profile)
  const queryClient = useQueryClient()
  const admin = isFullAdmin(profile)
  const { data: mensagens } = useMensagens()

  // Gestor de setor só gerencia as mensagens do próprio setor (nunca as de
  // 'Todos' nem de outro setor) — mesma regra de renderManageMessagesList do
  // protótipo.
  const scoped = useMemo(() => {
    if (admin) return mensagens ?? []
    return (mensagens ?? []).filter((m) => m.destino === profile?.setor)
  }, [mensagens, admin, profile])

  const [editing, setEditing] = useState<MensagemRow | null>(null)
  const [creating, setCreating] = useState(false)

  async function refetch() {
    await queryClient.invalidateQueries({ queryKey: MENSAGENS_KEY })
  }

  async function handleDelete(m: MensagemRow) {
    if (!(await confirmar('Excluir esta mensagem? Esta ação não pode ser desfeita.'))) return
    const { error } = await supabase.from('mensagens').delete().eq('id', m.id)
    if (error) {
      window.alert(error.message)
      return
    }
    await refetch()
  }

  const showForm = creating || !!editing

  return (
    <div className="modal-overlay">
      <div className="modal modal-wide">
        <div className="modal-header">
          <h3>Gerenciar Mensagens</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <button className="btn btn-primary" style={{ marginBottom: 16 }} onClick={() => setCreating(true)}>
            + Nova mensagem
          </button>
          <div className="manage-list">
            {scoped.length === 0 && <div className="empty-state">Nenhuma mensagem cadastrada.</div>}
            {scoped.map((m) => (
              <div className="manage-row" key={m.id}>
                <div className="manage-row-info">
                  <strong>{m.content}</strong>
                  <span>
                    {m.destino} · {m.author_nome} ·{' '}
                    {new Date(m.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
                <div className="manage-row-actions">
                  <button className="icon-btn" title="Editar" onClick={() => setEditing(m)}>
                    ✎
                  </button>
                  {admin && (
                    <button className="icon-btn danger" title="Excluir" onClick={() => handleDelete(m)}>
                      🗑
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showForm && (
        <MensagemFormModal
          mensagem={editing}
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

function MensagemFormModal({
  mensagem,
  onClose,
  onSaved,
}: {
  mensagem: MensagemRow | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const profile = useAuthStore((s) => s.profile)
  // Gestor de setor só publica/edita no próprio setor, nunca em 'Todos' —
  // por isso os outros botões de destino nem aparecem pra ele.
  const locked = isSetorManager(profile) ? profile?.setor : null
  const [content, setContent] = useState(mensagem?.content ?? '')
  const [destino, setDestino] = useState<MensagemDestino>(mensagem?.destino ?? locked ?? 'Todos')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const visibleDestinos = locked ? DESTINOS.filter((d) => d === locked) : DESTINOS
  const isValid = !!content.trim() && !!destino

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isValid || !profile) return
    setError(null)
    setSubmitting(true)
    try {
      const { error: saveError } = mensagem
        ? await supabase.from('mensagens').update({ content: content.trim(), destino }).eq('id', mensagem.id)
        : await supabase
            .from('mensagens')
            .insert({ content: content.trim(), destino, author_id: profile.id, author_nome: profile.nome })
      if (saveError) {
        setError(saveError.message)
        return
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
          <h3>{mensagem ? 'Editar mensagem' : 'Nova mensagem'}</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="field">
            <label>Mensagem *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="Escreva o comunicado, aviso ou lembrete..."
              required
            />
          </div>
          <div className="field">
            <label>Destino *</label>
            <div className="sector-filter">
              {visibleDestinos.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`sector-filter-btn ${destino === d ? 'active' : ''}`}
                  onClick={() => setDestino(d)}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="login-error">{error}</p>}
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={!isValid || submitting}>
              {submitting ? 'Publicando...' : 'Publicar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
