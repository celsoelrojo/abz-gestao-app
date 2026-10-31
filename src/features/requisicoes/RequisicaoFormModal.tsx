import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuthStore } from '../../store/authStore'
import {
  REQUISICAO_TIPOS,
  REQUISICAO_TIPO_LABELS,
  REQUISICAO_URGENCIAS,
  REQUISICAO_URGENCIA_LABELS,
} from './requisicaoConstants'
import { requisicaoFormError } from './requisicaoHelpers'
import {
  atualizarRequisicao,
  criarRequisicao,
  removerRequisicaoFoto,
  uploadRequisicaoFoto,
  useRequisicaoFotoUrl,
} from './useRequisicoes'
import type { RequisicaoRow, RequisicaoTipo, RequisicaoUrgencia } from '../../types/database'

export function RequisicaoFormModal({
  requisicao,
  onClose,
  onSaved,
}: {
  requisicao: RequisicaoRow | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const profile = useAuthStore((s) => s.profile)

  const [tipo, setTipo] = useState<RequisicaoTipo>(requisicao?.tipo ?? 'compra')
  const [titulo, setTitulo] = useState(requisicao?.titulo ?? '')
  const [descricao, setDescricao] = useState(requisicao?.descricao ?? '')
  const [urgencia, setUrgencia] = useState<RequisicaoUrgencia>(requisicao?.urgencia ?? 'media')
  // Foto já salva (path no bucket) e/ou uma nova escolhida agora. A antiga só é
  // apagada do bucket depois que o salvamento dá certo.
  const [fotoAtual, setFotoAtual] = useState<string | null>(requisicao?.foto_path ?? null)
  const [fotoNova, setFotoNova] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Prévia da foto recém-escolhida: um object URL por arquivo, liberado ao trocar/fechar.
  const fotoNovaUrl = useMemo(() => (fotoNova ? URL.createObjectURL(fotoNova) : null), [fotoNova])
  useEffect(() => () => { if (fotoNovaUrl) URL.revokeObjectURL(fotoNovaUrl) }, [fotoNovaUrl])

  const { data: fotoAtualUrl } = useRequisicaoFotoUrl(fotoNova ? null : fotoAtual)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const validationError = requisicaoFormError({ titulo })
    if (validationError) {
      setError(validationError)
      return
    }
    if (!profile) return

    setSubmitting(true)
    let fotoPath = fotoAtual
    let fotoEnviada: string | null = null
    try {
      if (fotoNova) {
        fotoEnviada = await uploadRequisicaoFoto(profile.id, fotoNova)
        fotoPath = fotoEnviada
      }
      const input = {
        tipo,
        titulo,
        descricao: descricao.trim() || null,
        urgencia,
        fotoPath,
      }
      if (requisicao) await atualizarRequisicao(requisicao.id, input)
      else await criarRequisicao(input)

      // Trocou ou tirou a foto: a anterior sai do bucket (órfã não serve a ninguém).
      if (requisicao?.foto_path && requisicao.foto_path !== fotoPath) await removerRequisicaoFoto(requisicao.foto_path)
      await onSaved()
    } catch (err) {
      // Falhou depois do upload: não deixa a foto nova solta no bucket.
      if (fotoEnviada) await removerRequisicaoFoto(fotoEnviada)
      setError(err instanceof Error ? err.message : 'Erro ao salvar a requisição.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal modal-wide">
        <div className="modal-header">
          <h3>{requisicao ? 'Editar requisição' : 'Nova requisição'}</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="field-row">
            <div className="field">
              <label>Tipo *</label>
              <div className="sector-filter">
                {REQUISICAO_TIPOS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`sector-filter-btn ${tipo === t ? 'active' : ''}`}
                    onClick={() => setTipo(t)}
                  >
                    {REQUISICAO_TIPO_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Urgência *</label>
              <div className="sector-filter">
                {REQUISICAO_URGENCIAS.map((u) => (
                  <button
                    key={u}
                    type="button"
                    className={`sector-filter-btn ${urgencia === u ? 'active' : ''}`}
                    onClick={() => setUrgencia(u)}
                  >
                    {REQUISICAO_URGENCIA_LABELS[u]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="field">
            <label>{tipo === 'compra' ? 'O que precisa ser comprado? *' : 'O que precisa ser consertado? *'}</label>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder={tipo === 'compra' ? 'Ex.: Lixeira nova para o bar' : 'Ex.: Ventilador do salão quebrou'}
              maxLength={120}
              required
            />
          </div>

          <div className="field">
            <label>Detalhes</label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              placeholder="Onde fica, o que aconteceu, quantidade, modelo..."
            />
          </div>

          <div className="field">
            <label>Foto (opcional)</label>
            {(fotoNovaUrl || fotoAtualUrl) && (
              <img
                src={fotoNovaUrl ?? fotoAtualUrl}
                alt="Foto da requisição"
                style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8, display: 'block', marginBottom: 8 }}
              />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                setFotoNova(e.target.files?.[0] ?? null)
              }}
            />
            {(fotoNova || fotoAtual) && (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ marginTop: 8 }}
                onClick={() => {
                  setFotoNova(null)
                  setFotoAtual(null)
                }}
              >
                Remover foto
              </button>
            )}
          </div>

          {error && <p className="login-error">{error}</p>}

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Enviando...' : requisicao ? 'Salvar' : 'Enviar requisição'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
