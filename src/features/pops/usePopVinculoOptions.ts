import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import type { PopVinculoTipo, Setor } from '../../types/database'

export interface PopVinculoOption {
  id: string
  title: string
  sub: string | null
}

export const POP_VINCULO_TIPOS: PopVinculoTipo[] = ['Mapa', 'POP']

// Vínculo próprio do POP (Mapa/outro POP) — mesmo padrão de
// useFichaVinculoOptions, mas restrito a Mapa/POP (Ficha Técnica/Produção
// não fazem sentido aqui). setor 'Geral' também busca Mapas de todos os
// setores, já que Mapas não têm conceito de 'Geral' próprio.
export function usePopVinculoOptions(tipo: PopVinculoTipo | null, setor: string | null, excludeId?: string) {
  return useQuery({
    queryKey: ['pop_vinculo_options', tipo, setor, excludeId],
    enabled: !!tipo && !!setor,
    queryFn: async (): Promise<PopVinculoOption[]> => {
      if (!tipo || !setor) return []

      if (tipo === 'Mapa') {
        const query = supabase.from('mapas_fluxogramas').select('id, title, kind')
        const { data, error } = setor === 'Geral' ? await query : await query.eq('setor', setor as Setor)
        if (error) throw error
        return data.map((m) => ({ id: m.id, title: m.title, sub: m.kind === 'fluxograma' ? 'Fluxograma' : null }))
      }

      const query = supabase.from('pops').select('id, titulo, setor').eq('status', 'publicada')
      const { data, error } =
        setor === 'Geral' ? await query : await query.or(`setor.eq.${setor},setor.eq.Geral`)
      if (error) throw error
      return data.filter((p) => p.id !== excludeId).map((p) => ({ id: p.id, title: p.titulo, sub: p.setor }))
    },
  })
}
