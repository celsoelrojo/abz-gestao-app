import { useEffect, useRef } from 'react'

const TAMANHOS = [
  { label: 'Pequena', px: '13px' },
  { label: 'Normal', px: '16px' },
  { label: 'Média', px: '20px' },
  { label: 'Grande', px: '26px' },
  { label: 'Título', px: '34px' },
]

// Editor de texto rico mínimo, sem biblioteca — pedido do usuário foi só
// negrito/itálico/sublinhado/tamanho de fonte, então um <div contentEditable>
// com document.execCommand (ainda funcional em todos os navegadores atuais
// pra esses comandos básicos, apesar de "deprecated") resolve sem trazer uma
// dependência nova pro projeto. O HTML produzido NUNCA é confiado direto —
// quem grava (lib/richText.sanitizeRichText no ponto de salvar) e quem lê
// (mesma sanitização no ponto de renderizar) que garantem isso; este
// componente só edita.
export function RichTextEditor({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (html: string) => void
  disabled?: boolean
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const savedRangeRef = useRef<Range | null>(null)

  // contentEditable não é um input controlado de verdade — resincronizar o
  // innerHTML a cada tecla (via `value`) faria o cursor pular pro início.
  // Só reflete de fora quando o valor realmente mudou (troca de seção,
  // carregamento inicial, cancelar edição).
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || ''
    }
  }, [value])

  function handleInput() {
    if (editorRef.current) onChange(editorRef.current.innerHTML)
  }

  function saveSelection() {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedRangeRef.current = sel.getRangeAt(0)
    }
  }

  function restoreSelection() {
    const sel = window.getSelection()
    if (sel && savedRangeRef.current) {
      sel.removeAllRanges()
      sel.addRange(savedRangeRef.current)
    }
  }

  function exec(command: string) {
    editorRef.current?.focus()
    restoreSelection()
    document.execCommand(command)
    handleInput()
  }

  // execCommand('fontSize') só aceita os 7 tamanhos legados do HTML (gera
  // <font size="7">), sem CSS — pede o maior (7, garantido único na seleção)
  // e troca cada <font size="7"> pelo <span style="font-size:..."> real.
  function handleFontSize(px: string) {
    if (!px || !editorRef.current) return
    editorRef.current.focus()
    restoreSelection()
    document.execCommand('fontSize', false, '7')
    editorRef.current.querySelectorAll('font[size="7"]').forEach((el) => {
      const span = document.createElement('span')
      span.style.fontSize = px
      span.innerHTML = (el as HTMLElement).innerHTML
      el.replaceWith(span)
    })
    handleInput()
  }

  return (
    <div className="rich-text-editor">
      {!disabled && (
        <div className="rich-text-toolbar">
          <button type="button" className="rich-text-btn" title="Negrito" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('bold')}>
            <strong>N</strong>
          </button>
          <button type="button" className="rich-text-btn" title="Itálico" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('italic')}>
            <em>I</em>
          </button>
          <button
            type="button"
            className="rich-text-btn"
            title="Sublinhado"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec('underline')}
          >
            <u>S</u>
          </button>
          <select
            className="rich-text-size"
            defaultValue=""
            onChange={(e) => {
              handleFontSize(e.target.value)
              e.target.value = ''
            }}
          >
            <option value="" disabled>
              Tamanho da fonte
            </option>
            {TAMANHOS.map((t) => (
              <option key={t.px} value={t.px}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div
        ref={editorRef}
        className="rich-text-body"
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={handleInput}
        onMouseUp={saveSelection}
        onKeyUp={saveSelection}
      />
    </div>
  )
}
