import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabaseClient'
import { sanitizeRichText } from '../../lib/richText'
import type { SobreNosSecaoChave, SobreNosSecaoRow } from '../../types/database'

export const SOBRE_NOS_KEY = ['sobre_nos_secoes']

// As 3 linhas já existem desde a migration (0034) — não há criar/apagar
// seção aqui, só leitura + atualização de conteúdo.
export function useSobreNosSecoes() {
  return useQuery({
    queryKey: SOBRE_NOS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('sobre_nos_secoes').select('*')
      if (error) throw error
      return data as SobreNosSecaoRow[]
    },
  })
}

export function useSobreNosRealtime() {
  const queryClient = useQueryClient()
  useEffect(() => {
    const channel = supabase
      .channel('sobre_nos_secoes:all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sobre_nos_secoes' }, () => {
        queryClient.invalidateQueries({ queryKey: SOBRE_NOS_KEY })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}

// Sanitiza de novo aqui (além da sanitização no ponto de leitura, ver
// SobreNosSecaoView) — defesa em duas camadas: o que entra no banco já vem
// limpo, e o que é lido é tratado como não confiável mesmo assim.
export async function atualizarSecaoSobreNos(chave: SobreNosSecaoChave, conteudoHtml: string): Promise<void> {
  const userId = useAuthStore.getState().profile?.id ?? null
  const { error } = await supabase
    .from('sobre_nos_secoes')
    .update({ conteudo_html: sanitizeRichText(conteudoHtml), atualizado_por: userId, atualizado_em: new Date().toISOString() })
    .eq('chave', chave)
  if (error) throw error
}
