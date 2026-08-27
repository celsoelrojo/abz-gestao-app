import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { MapaBlockRow, MapaFluxogramaRow } from '../../types/database'

export const MAPAS_KEY = ['mapas_fluxogramas']
export const MAPA_BLOCKS_KEY = (mapaId: string) => ['mapa_blocks', mapaId]

// RLS já resolve: Administrador vê todos os setores, os demais só o próprio.
export function useMapasFluxogramas() {
  return useQuery({
    queryKey: MAPAS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('mapas_fluxogramas').select('*').order('ordem')
      if (error) throw error
      return data as MapaFluxogramaRow[]
    },
  })
}

export function useMapaBlocks(mapaId: string | undefined) {
  return useQuery({
    queryKey: MAPA_BLOCKS_KEY(mapaId ?? ''),
    enabled: !!mapaId,
    queryFn: async () => {
      const { data, error } = await supabase.from('mapa_blocks').select('*').eq('mapa_id', mapaId!).order('ordem')
      if (error) throw error
      return data as MapaBlockRow[]
    },
  })
}

export function useMapasRealtime() {
  const queryClient = useQueryClient()
  useEffect(() => {
    const channel = supabase
      .channel('mapas_fluxogramas:all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mapas_fluxogramas' }, () => {
        queryClient.invalidateQueries({ queryKey: MAPAS_KEY })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mapa_blocks' }, () => {
        queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'mapa_blocks' })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}
