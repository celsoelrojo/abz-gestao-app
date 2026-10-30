import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './theme.css'
import { registerSW } from 'virtual:pwa-register'

// App instalado (PWA): com registerType 'autoUpdate' a página recarrega sozinha
// quando uma versão nova assume o controle. Sem isto, o app instalado ficava
// preso na versão antiga até o usuário fechar e reabrir (às vezes duas vezes).
// A verificação de versão nova roda ao abrir, ao voltar pro app (aba/janela
// visível de novo) e de hora em hora — o app instalado pode ficar dias aberto.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    const verificar = () => {
      registration.update().catch(() => {})
    }
    setInterval(verificar, 60 * 60 * 1000)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') verificar()
    })
  },
})

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
