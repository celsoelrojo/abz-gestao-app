import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { FichaProducaoLoteRow, FichaProducaoRow } from '../../types/database'

export const FICHAS_PRODUCAO_KEY = ['fichas_producao']
export const FICHAS_PRODUCAO_LOTES_KEY = (fichaId: string) => ['fichas_producao_lotes', fichaId]

// RLS já resolve: Administrador/Gestor do setor veem tudo do próprio setor
// (qualquer status); Bar/Cozinha comum só publicada do próprio setor.
export function useFichasProducao() {
  return useQuery({
    queryKey: FICHAS_PRODUCAO_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('fichas_producao').select('*').order('nome')
      if (error) throw error
      return data as FichaProducaoRow[]
    },
  })
}

export function useFichaProducaoLotes(fichaId: string | undefined) {
  return useQuery({
    queryKey: FICHAS_PRODUCAO_LOTES_KEY(fichaId ?? ''),
    enabled: !!fichaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fichas_producao_lotes')
        .select('*')
        .eq('ficha_id', fichaId!)
        .order('data_hora_producao', { ascending: false })
      if (error) throw error
      return data as FichaProducaoLoteRow[]
    },
  })
}

export function useFichasProducaoRealtime() {
  const queryClient = useQueryClient()
  useEffect(() => {
    const channel = supabase
      .channel('fichas_producao:all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fichas_producao' }, () => {
        queryClient.invalidateQueries({ queryKey: FICHAS_PRODUCAO_KEY })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fichas_producao_lotes' }, () => {
        queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'fichas_producao_lotes' })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}
