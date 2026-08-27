import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { FreelancerRow, Setor } from '../../types/database'

const SETORES: Setor[] = ['Bar', 'Cozinha', 'Salão']

export function FreelancerFormModal({
  freelancer,
  onClose,
  onSaved,
}: {
  freelancer: FreelancerRow | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const isEdit = !!freelancer
  const [nome, setNome] = useState(freelancer?.nome ?? '')
  const [setor, setSetor] = useState<Setor>(freelancer?.setor ?? 'Bar')
  const [funcao, setFuncao] = useState(freelancer?.funcao ?? '')
  const [telefone, setTelefone] = useState(freelancer?.telefone ?? '')
  const [email, setEmail] = useState(freelancer?.email ?? '')
  const [observacoes, setObservacoes] = useState(freelancer?.observacoes ?? '')
  const [status, setStatus] = useState<'ativo' | 'inativo'>(freelancer?.status ?? 'ativo')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const isValid = !!nome.trim() && !!funcao.trim() && !!telefone.trim()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isValid) return
    setError(null)
    setSubmitting(true)
    try {
      const payload = {
        nome: nome.trim(),
        setor,
        funcao: funcao.trim(),
        telefone: telefone.trim(),
        email: email.trim() || null,
        observacoes: observacoes.trim() || null,
        status,
      }
      const { error: saveError } = freelancer
        ? await supabase.from('freelancers').update(payload).eq('id', freelancer.id)
        : await supabase.from('freelancers').insert(payload)
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
          <h3>{isEdit ? 'Editar freelancer' : 'Novo freelancer'}</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="field">
            <label>Nome *</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Setor *</label>
              <select value={setor} onChange={(e) => setSetor(e.target.value as Setor)}>
                {SETORES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Função *</label>
              <input value={funcao} onChange={(e) => setFuncao(e.target.value)} required />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Telefone *</label>
              <input value={telefone} onChange={(e) => setTelefone(e.target.value)} required />
            </div>
            <div className="field">
              <label>E-mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Observações</label>
            <textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>
          {isEdit && (
            <div className="field">
              <label>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as 'ativo' | 'inativo')}>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
          )}

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
