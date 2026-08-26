import { useMemo, useState, type FormEvent } from 'react'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabaseClient'
import { calcValidadeDateTime, gerarNumeroLote } from './fichaHelpers'
import { uploadFichaImagem } from './fichaStorage'
import type { FichaProducaoLoteRow, FichaProducaoRow } from '../../types/database'

function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function FichaProducaoLoteFormModal({
  ficha,
  lotesExistentes,
  onClose,
  onSaved,
}: {
  ficha: FichaProducaoRow
  lotesExistentes: FichaProducaoLoteRow[]
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const profile = useAuthStore((s) => s.profile)
  const agora = useMemo(() => new Date(), [])

  const [dataHoraProducao, setDataHoraProducao] = useState(toDatetimeLocal(agora))
  const [numeroLote, setNumeroLote] = useState(() => {
    const dd = String(agora.getDate()).padStart(2, '0')
    const mm = String(agora.getMonth() + 1).padStart(2, '0')
    const prefixoHoje = `${dd}${mm}`
    const seq = lotesExistentes.filter((l) => l.numero_lote.includes(`-${prefixoHoje}-`)).length + 1
    return gerarNumeroLote(ficha.nome, ficha.codigo, agora, seq)
  })
  const [responsavel, setResponsavel] = useState(profile?.nome ?? '')
  const [quantidadeProduzida, setQuantidadeProduzida] = useState('')
  const [observacao, setObservacao] = useState('')
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const [ajustarValidade, setAjustarValidade] = useState(false)
  const [validadeManual, setValidadeManual] = useState('')
  const [justificativaAlteracao, setJustificativaAlteracao] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const validadeCalculada = calcValidadeDateTime(new Date(dataHoraProducao), ficha.prazo_validade, ficha.unidade_validade)

  const isValid =
    !!numeroLote.trim() &&
    !!responsavel.trim() &&
    !!quantidadeProduzida.trim() &&
    !!dataHoraProducao &&
    (!ajustarValidade || (!!validadeManual && !!justificativaAlteracao.trim()))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isValid) return
    setError(null)
    setSubmitting(true)
    try {
      let fotoUrl: string | null = null
      if (fotoFile) {
        setUploading(true)
        fotoUrl = await uploadFichaImagem(ficha.setor, fotoFile)
        setUploading(false)
      }

      const validadeFinal = ajustarValidade ? new Date(validadeManual).toISOString() : validadeCalculada?.toISOString() ?? null

      const { error: insertError } = await supabase.from('fichas_producao_lotes').insert({
        ficha_id: ficha.id,
        numero_lote: numeroLote.trim(),
        data_hora_producao: new Date(dataHoraProducao).toISOString(),
        responsavel: responsavel.trim(),
        quantidade_produzida: quantidadeProduzida.trim(),
        data_hora_validade: validadeFinal,
        justificativa_alteracao: ajustarValidade ? justificativaAlteracao.trim() : null,
        observacao: observacao.trim() || null,
        foto_url: fotoUrl,
      })
      if (insertError) {
        setError(insertError.message)
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
          <h3>Registrar lote — {ficha.nome}</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="field-row">
            <div className="field">
              <label>Data/hora da produção *</label>
              <input type="datetime-local" value={dataHoraProducao} onChange={(e) => setDataHoraProducao(e.target.value)} required />
            </div>
            <div className="field">
              <label>Número do lote *</label>
              <input value={numeroLote} onChange={(e) => setNumeroLote(e.target.value)} required />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Responsável *</label>
              <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} required />
            </div>
            <div className="field">
              <label>Quantidade produzida *</label>
              <input value={quantidadeProduzida} onChange={(e) => setQuantidadeProduzida(e.target.value)} required />
            </div>
          </div>

          <div>
            <label className="checkbox-field">
              <input type="checkbox" checked={ajustarValidade} onChange={(e) => setAjustarValidade(e.target.checked)} />
              Ajustar validade manualmente
            </label>
            {!ajustarValidade && (
              <span className="field-hint">
                Validade calculada: {validadeCalculada ? validadeCalculada.toLocaleString('pt-BR') : 'configure prazo de validade na ficha'}
              </span>
            )}
          </div>
          {ajustarValidade && (
            <div className="field-row">
              <div className="field">
                <label>Nova data/hora de validade *</label>
                <input type="datetime-local" value={validadeManual} onChange={(e) => setValidadeManual(e.target.value)} required />
              </div>
              <div className="field">
                <label>Justificativa da alteração *</label>
                <input value={justificativaAlteracao} onChange={(e) => setJustificativaAlteracao(e.target.value)} required />
              </div>
            </div>
          )}

          <div className="field">
            <label>Observação</label>
            <textarea rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>
          <div className="field">
            <label>Foto</label>
            <input type="file" accept="image/*" onChange={(e) => setFotoFile(e.target.files?.[0] ?? null)} />
          </div>

          {error && <p className="login-error">{error}</p>}

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={!isValid || submitting}>
              {uploading ? 'Enviando foto...' : submitting ? 'Registrando...' : 'Registrar lote'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
