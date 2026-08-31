import { resolverConfirmacao, useConfirmStore } from '../store/confirmStore'

// Um único modal, montado uma vez em App.tsx — qualquer tela chama
// confirmar('mensagem') e recebe true/false quando o usuário decide. Ver
// confirmStore.ts pro motivo de existir (window.confirm não é confiável
// neste app).
export function ConfirmModal() {
  const message = useConfirmStore((s) => s.message)
  if (!message) return null

  return (
    <div className="modal-overlay" onClick={() => resolverConfirmacao(false)}>
      <div id="confirm-modal" className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Confirmar</h3>
          <button className="modal-close" onClick={() => resolverConfirmacao(false)}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p className="confirm-message">{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => resolverConfirmacao(false)}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={() => resolverConfirmacao(true)}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}
