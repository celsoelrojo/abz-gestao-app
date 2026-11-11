import { create } from 'zustand'

// Substitui window.confirm() em todo o app — o próprio protótipo já tinha
// descoberto (script.js, confirmAction/pendingConfirmAction) que
// window.confirm() fica bloqueado/é silenciosamente ignorado dependendo do
// contexto em que a página roda (iframe restrito, alguns navegadores
// mobile/PWA), fazendo o clique em "Excluir" não fazer nada. A solução do
// protótipo era um modal custom único, controlado por uma "ação pendente" —
// aqui o mesmo padrão, só que como uma Promise<boolean> pra poder escrever
// `if (!(await confirmar('...'))) return` no lugar de
// `if (!window.confirm('...')) return`.
interface ConfirmState {
  message: string | null
  // true = só um aviso com "OK" (sem "Cancelar"), aberto por avisar().
  somenteAviso: boolean
  resolve: ((value: boolean) => void) | null
}

export const useConfirmStore = create<ConfirmState>(() => ({ message: null, somenteAviso: false, resolve: null }))

export function confirmar(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    // Se já houver uma confirmação pendente (não deveria, mas por segurança),
    // resolve como cancelada antes de abrir a nova.
    useConfirmStore.getState().resolve?.(false)
    useConfirmStore.setState({ message, somenteAviso: false, resolve })
  })
}

// Aviso informativo (ex.: "pedido enviado ao Administrador"): mesmo modal, só "OK".
export async function avisar(message: string): Promise<void> {
  await new Promise<boolean>((resolve) => {
    useConfirmStore.getState().resolve?.(false)
    useConfirmStore.setState({ message, somenteAviso: true, resolve })
  })
}

export function resolverConfirmacao(value: boolean) {
  const { resolve } = useConfirmStore.getState()
  resolve?.(value)
  useConfirmStore.setState({ message: null, somenteAviso: false, resolve: null })
}
