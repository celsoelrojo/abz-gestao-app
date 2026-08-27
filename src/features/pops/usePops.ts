import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { PopCategoryRow, PopRow } from '../../types/database'

export const POPS_KEY = ['pops']
export const POP_CATEGORIES_KEY = ['pop_categories']

// RLS já resolve: Administrador vê tudo (qualquer status/setor); os demais
// só publicada, do próprio setor ou 'Geral'.
export function usePops() {
  return useQuery({
    queryKey: POPS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('pops').select('*').order('ordem')
      if (error) throw error
      return data as PopRow[]
    },
  })
}

export function usePopCategories() {
  return useQuery({
    queryKey: POP_CATEGORIES_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('pop_categories').select('*').order('ordem')
      if (error) throw error
      return data as PopCategoryRow[]
    },
  })
}

export function usePopsRealtime() {
  const queryClient = useQueryClient()
  useEffect(() => {
    const channel = supabase
      .channel('pops:all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pops' }, () => {
        queryClient.invalidateQueries({ queryKey: POPS_KEY })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pop_categories' }, () => {
        queryClient.invalidateQueries({ queryKey: POP_CATEGORIES_KEY })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}
