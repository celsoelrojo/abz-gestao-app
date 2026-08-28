import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabaseClient'
import type { Setor } from '../types/database'

export type VinculoTipo = 'Mapa' | 'POP' | 'Ficha de Produção'
export const VINCULO_TIPOS: VinculoTipo[] = ['Mapa', 'POP', 'Ficha de Produção']

export interface VinculoOption {
  id: string
  title: string
  sub: string | null
}

// Espelha getVinculoOptions() do protótipo (script.js:1314-1334). "Ficha de
// Produção" como TIPO de vínculo é o nome dado à opção que na verdade busca
// em Fichas Técnicas E Fichas de Produção publicadas do setor (rotuladas
// pelo `sub` pra diferenciar) — não é um erro, é assim que o protótipo
// sempre funcionou. Mapas e Fluxogramas não têm status de publicação, então
// entram todos do setor. POP aceita também setor 'Geral'.
//
// Movido de features/checklist/ pra lib/ porque agora tem dois usos reais:
// o vínculo de tarefa do Checklist e o vínculo da própria Ficha de Produção
// (FichaProducaoFormModal) — nenhum dos dois é "dono" da lógica. `excludeId`
// só importa pro segundo caso (uma ficha não pode se vincular a si mesma).
export function useVinculoOptions(tipo: VinculoTipo | null, setor: Setor | null, excludeId?: string) {
  return useQuery({
    queryKey: ['vinculo_options', tipo, setor, excludeId],
    enabled: !!tipo && !!setor,
    queryFn: async (): Promise<VinculoOption[]> => {
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

      // 'Ficha de Produção': união de Fichas Técnicas + Fichas de Produção publicadas.
      const [tecnicas, producoes] = await Promise.all([
        supabase.from('fichas_tecnicas').select('id, nome').eq('status', 'publicada').eq('setor', setor),
        supabase.from('fichas_producao').select('id, nome').eq('status', 'publicada').eq('setor', setor),
      ])
      if (tecnicas.error) throw tecnicas.error
      if (producoes.error) throw producoes.error
      return [
        ...tecnicas.data.map((f) => ({ id: f.id, title: f.nome, sub: 'Ficha Técnica' })),
        ...producoes.data.filter((f) => f.id !== excludeId).map((f) => ({ id: f.id, title: f.nome, sub: 'Ficha de Produção' })),
      ]
    },
  })
}
