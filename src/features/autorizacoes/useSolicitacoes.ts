import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { avisar } from '../../store/confirmStore'
import { isFullAdmin, isGestorGeral, useAuthStore } from '../../store/authStore'
import { anexosDoRegistro, rotuloTabela } from './exclusaoHelpers'
import type { SolicitacaoExclusaoRow } from '../../types/database'

export const SOLICITACOES_KEY = ['solicitacoes_exclusao']

// Pela RLS, o Administrador recebe todos os pedidos e o Gestor Geral só os próprios.
export function useSolicitacoes(enabled = true) {
  return useQuery({
    queryKey: SOLICITACOES_KEY,
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solicitacoes_exclusao')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data as SolicitacaoExclusaoRow[]
    },
  })
}

// Montado uma vez no App. Mantém a lista e o contador atualizados e, pro
// Gestor Geral, avisa na hora: a exclusão que ele pediu virou um pedido (a
// linha não é apagada e a tela dele não dá erro), e quando o Administrador decide.
export function useSolicitacoesRealtime() {
  const queryClient = useQueryClient()
  const profile = useAuthStore((s) => s.profile)
  const perfilId = profile?.id
  const acesso = isFullAdmin(profile)
  const gestorGeral = isGestorGeral(profile)

  useEffect(() => {
    if (!perfilId || !acesso) return
    const channel = supabase
      .channel('solicitacoes_exclusao:all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitacoes_exclusao' }, (payload) => {
        void queryClient.invalidateQueries({ queryKey: SOLICITACOES_KEY })
        const s = payload.new as Partial<SolicitacaoExclusaoRow>
        if (!gestorGeral || s.solicitante_id !== perfilId) return
        if (payload.eventType === 'INSERT') {
          void avisar(
            `Você não pode apagar direto: enviei um pedido de autorização ao Administrador para apagar ${rotuloTabela(s.tabela ?? '')} "${s.descricao}". O registro continua aí até ele aprovar.`,
          )
        } else if (payload.eventType === 'UPDATE' && s.status && s.status !== 'pendente') {
          void avisar(
            `O Administrador ${s.status === 'aprovada' ? 'aprovou' : 'recusou'} o pedido para apagar "${s.descricao}"${s.resposta ? `: ${s.resposta}` : '.'}`,
          )
          void queryClient.invalidateQueries()
        }
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient, perfilId, acesso, gestorGeral])
}

// Aprovar apaga o registro no banco e então os anexos dele no storage;
// recusar só encerra o pedido. A resposta (opcional) volta pro Gestor Geral.
export async function resolverExclusao(s: SolicitacaoExclusaoRow, aprovar: boolean, resposta: string): Promise<void> {
  const { error } = await supabase.rpc('resolver_exclusao', { p_id: s.id, p_aprovar: aprovar, p_resposta: resposta.trim() || null })
  if (error) throw error
  if (aprovar) {
    for (const { bucket, path } of anexosDoRegistro(s.tabela, s.dados)) {
      await supabase.storage.from(bucket).remove([path]).catch(() => undefined)
    }
  }
}
