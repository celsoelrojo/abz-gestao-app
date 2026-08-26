import { useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'

// Assina o estado de autenticação real do Supabase (login, logout, refresh de
// token) e mantém o profile (role/setor) sincronizado — substitui o
// state.currentUser hardcoded do protótipo por sessão + linha real do banco.
export function useSessionSync() {
  const setSession = useAuthStore((s) => s.setSession)
  const setProfile = useAuthStore((s) => s.setProfile)
  const setLoading = useAuthStore((s) => s.setLoading)

  useEffect(() => {
    let active = true

    async function loadProfile(userId: string) {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (!active) return
      if (error) {
        console.error('Falha ao carregar profile:', error.message)
        setProfile(null)
      } else {
        setProfile(data)
      }
      setLoading(false)
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      if (data.session) loadProfile(data.session.user.id)
      else setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) loadProfile(session.user.id)
      else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
