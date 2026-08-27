import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { uploadMapaImagem } from './mapaStorage'
import type { MapaBlockRow, MapaBlockTipo } from '../../types/database'

export function MapaBlockFormModal({
  mapaId,
  setor,
  proximaOrdem,
  block,
  tipoInicial,
  onClose,
  onSaved,
}: {
  mapaId: string
  setor: string
  proximaOrdem: number
  block: MapaBlockRow | null
  tipoInicial: MapaBlockTipo
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const isEdit = !!block
  const [type] = useState<MapaBlockTipo>(block?.type ?? tipoInicial)
  const [title, setTitle] = useState(block?.title ?? '')
  const [content, setContent] = useState(block?.content ?? '')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const isValid = type === 'text' ? !!content.trim() : isEdit || !!imageFile

  async function handleSubmit() {
    if (!isValid) return
    setError(null)
    setSubmitting(true)
    try {
      let imageUrl = block?.image_url ?? null
      if (type === 'image' && imageFile) {
        setUploading(true)
        imageUrl = await uploadMapaImagem(setor, imageFile)
        setUploading(false)
      }

      if (block) {
        const { error: updateError } = await supabase
          .from('mapa_blocks')
          .update({ title: title.trim(), content: type === 'text' ? content : null, image_url: type === 'image' ? imageUrl : null })
          .eq('id', block.id)
        if (updateError) {
          setError(updateError.message)
          return
        }
      } else {
        const { error: insertError } = await supabase.from('mapa_blocks').insert({
          mapa_id: mapaId,
          type,
          title: title.trim(),
          content: type === 'text' ? content : null,
          image_url: type === 'image' ? imageUrl : null,
          ordem: proximaOrdem,
        })
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
          <h3>{isEdit ? 'Editar bloco' : type === 'text' ? 'Novo bloco de texto' : 'Novo bloco de imagem'}</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Título</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          {type === 'text' ? (
            <div className="field">
              <label>Conteúdo *</label>
              <textarea rows={5} value={content} onChange={(e) => setContent(e.target.value)} required />
            </div>
          ) : (
            <div className="field">
              <label>{isEdit ? 'Substituir imagem' : 'Imagem *'}</label>
              <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} disabled={uploading} />
              {uploading && <span className="field-hint">Enviando...</span>}
            </div>
          )}

          {error && <p className="login-error">{error}</p>}

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" disabled={!isValid || submitting} onClick={handleSubmit}>
              {submitting ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
