import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { isManager, useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabaseClient'
import type { FichaTecnicaRow, FichaTecnicaSemCustoRow } from '../../types/database'

export const FICHAS_TECNICAS_KEY = ['fichas_tecnicas']

// Administrador e Gestor do setor leem a tabela cheia (com custo);
// Bartender/Cozinheiro leem a view fichas_tecnicas_sem_custo (sem
// embalagem/preço sugerido, sem qtdBase/precoBase por ingrediente) — essa
// sim é uma garantia real do banco (RLS + view), não só esconder no front
// como o protótipo fazia.
export function useFichasTecnicas() {
  const profile = useAuthStore((s) => s.profile)
  const canSeeCusto = isManager(profile, undefined)

  return useQuery({
    queryKey: [...FICHAS_TECNICAS_KEY, canSeeCusto],
    queryFn: async (): Promise<FichaTecnicaRow[]> => {
      if (canSeeCusto) {
        const { data, error } = await supabase.from('fichas_tecnicas').select('*').order('nome')
        if (error) throw error
        return data as FichaTecnicaRow[]
      }
      const { data, error } = await supabase.from('fichas_tecnicas_sem_custo').select('*').order('nome')
      if (error) throw error
      return (data as FichaTecnicaSemCustoRow[]).map((f) => ({
        ...f,
        embalagem: null,
        preco_sugerido: null,
        ingredientes: f.ingredientes.map((i) => ({ ...i, qtdBase: null, precoBase: null })),
      }))
    },
  })
}

export function useFichasTecnicasRealtime() {
  const queryClient = useQueryClient()
  useEffect(() => {
    const channel = supabase
      .channel('fichas_tecnicas:all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fichas_tecnicas' }, () => {
        queryClient.invalidateQueries({ queryKey: FICHAS_TECNICAS_KEY, exact: false })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}
