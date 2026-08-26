import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import type { FichaVinculoTipo, Setor } from '../../types/database'

export const FICHA_VINCULO_TIPOS: FichaVinculoTipo[] = ['Mapa', 'POP', 'Ficha Técnica']

export interface FichaVinculoOption {
  id: string
  title: string
  sub: string | null
}

// Vínculo próprio da Ficha Técnica (diferente do vínculo genérico do
// Checklist, que rotula a terceira opção "Ficha de Produção" e busca em duas
// tabelas). Aqui uma Ficha Técnica só linka a Mapa/POP/outra Ficha Técnica
// publicada do mesmo setor — nunca a si mesma.
export function useFichaVinculoOptions(tipo: FichaVinculoTipo | null, setor: Setor | null, excludeId?: string) {
  return useQuery({
    queryKey: ['ficha_vinculo_options', tipo, setor, excludeId],
    enabled: !!tipo && !!setor,
    queryFn: async (): Promise<FichaVinculoOption[]> => {
      if (!tipo || !setor) return []

      if (tipo === 'Mapa') {
        const { data, error } = await supabase.from('mapas_fluxogramas').select('id, title, kind').eq('setor', setor)
        if (error) throw error
        return data.map((m) => ({ id: m.id, title: m.title, sub: m.kind === 'fluxograma' ? 'Fluxograma' : null }))
      }

      if (tipo === 'POP') {
        const { data, error } = await supabase
          .from('pops')
          .select('id, titulo')
          .eq('status', 'publicada')
          .or(`setor.eq.${setor},setor.eq.Geral`)
        if (error) throw error
        return data.map((p) => ({ id: p.id, title: p.titulo, sub: null }))
      }

      const { data, error } = await supabase
        .from('fichas_tecnicas')
        .select('id, nome')
        .eq('status', 'publicada')
        .eq('setor', setor)
      if (error) throw error
      return data.filter((f) => f.id !== excludeId).map((f) => ({ id: f.id, title: f.nome, sub: null }))
    },
  })
}
