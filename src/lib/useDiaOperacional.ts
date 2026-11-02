import { useEffect, useMemo, useState } from 'react'
import { diaOperacional, isoDate } from './date'

// Dia operacional atual (ver diaOperacional). Reavalia a cada minuto e ao
// voltar pro app, pra tela deixada aberta durante a noite virar às 5h sozinha.
export function useDiaOperacional(): Date {
  const [iso, setIso] = useState(() => isoDate(diaOperacional()))

  useEffect(() => {
    const atualizar = () => setIso(isoDate(diaOperacional()))
    const timer = setInterval(atualizar, 60_000)
    document.addEventListener('visibilitychange', atualizar)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', atualizar)
    }
  }, [])

  return useMemo(() => new Date(`${iso}T00:00:00`), [iso])
}
