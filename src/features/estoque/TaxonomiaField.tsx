import { useState } from 'react'

// Select de valor controlado (categoria/subcategoria), com um botão pequeno
// ao lado pra registrar um valor novo na tabela de sugestões (taxonomias) e
// já deixá-lo selecionado — pedido explícito do usuário ("botão pequeno ao
// lado: adicionar categoria/subcategoria"), diferente do padrão de
// input+datalist livre usado na aba Entrada. Compartilhado entre o cadastro
// de produto novo e a edição de um já existente.
export function TaxonomiaField({
  label,
  valor,
  onChange,
  opcoes,
  onAdd,
  addTitle,
  placeholder,
}: {
  label: string
  valor: string
  onChange: (v: string) => void
  opcoes: string[]
  onAdd: (v: string) => void
  addTitle: string
  placeholder: string
}) {
  const [adding, setAdding] = useState(false)
  const [novo, setNovo] = useState('')

  function confirmAdd() {
    const v = novo.trim()
    if (!v) return
    onAdd(v)
    setNovo('')
    setAdding(false)
  }

  return (
    <div className="field">
      <label>{label}</label>
      {adding ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            placeholder={placeholder}
            autoFocus
            style={{ flex: 1 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                confirmAdd()
              }
              if (e.key === 'Escape') {
                setAdding(false)
                setNovo('')
              }
            }}
          />
          <button type="button" className="icon-btn" title="Confirmar" onClick={confirmAdd}>
            ✓
          </button>
          <button
            type="button"
            className="icon-btn"
            title="Cancelar"
            onClick={() => {
              setAdding(false)
              setNovo('')
            }}
          >
            ✕
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={valor} onChange={(e) => onChange(e.target.value)} style={{ flex: 1 }}>
            <option value="">Selecione...</option>
            {opcoes.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <button type="button" className="icon-btn" title={addTitle} onClick={() => setAdding(true)}>
            +
          </button>
        </div>
      )}
    </div>
  )
}
