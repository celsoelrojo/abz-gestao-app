import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { expiracaoDoCodigo, gerarCodigoAtivacao } from './notificacaoHelpers'
import type { NotificacaoDestinoRow, Setor } from '../../types/database'

export const NOTIFICACAO_DESTINOS_KEY = ['notificacao_destinos']
export const TELEGRAM_STATUS_KEY = ['telegram_status']

export function useNotificacaoDestinos() {
  return useQuery({
    queryKey: NOTIFICACAO_DESTINOS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('notificacao_destinos').select('*').order('created_at')
      if (error) throw error
      return data as NotificacaoDestinoRow[]
    },
  })
}

export async function criarDestino(nome: string, setor: Setor | null): Promise<void> {
  const { error } = await supabase.from('notificacao_destinos').insert({
    nome: nome.trim(),
    setor,
    codigo_ativacao: gerarCodigoAtivacao(),
    codigo_expira_em: expiracaoDoCodigo(),
  })
  if (error) throw error
}

// Código novo pra reconectar (ou conectar outro chat) quando o anterior expirou.
export async function novoCodigoDestino(id: string): Promise<void> {
  const { error } = await supabase
    .from('notificacao_destinos')
    .update({ codigo_ativacao: gerarCodigoAtivacao(), codigo_expira_em: expiracaoDoCodigo(), chat_id: null, chat_nome: null })
    .eq('id', id)
  if (error) throw error
}

export async function atualizarDestino(
  id: string,
  patch: Partial<Pick<NotificacaoDestinoRow, 'nome' | 'setor' | 'avisar_conclusoes' | 'avisar_pendencias' | 'ativo'>>,
): Promise<void> {
  const { error } = await supabase.from('notificacao_destinos').update(patch).eq('id', id)
  if (error) throw error
}

// Gestor Geral: o banco não apaga e abre um pedido de autorização (0 linhas, sem erro).
export async function excluirDestino(id: string): Promise<void> {
  const { error } = await supabase.from('notificacao_destinos').delete().eq('id', id)
  if (error) throw error
}

export interface TelegramStatus {
  bot: string | null
  webhook_ativo: boolean
  ultimo_erro: string | null
}

// A função devolve a mensagem útil no corpo do erro (FunctionsHttpError guarda a Response).
async function chamarFuncao<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('notificar-telegram', { body })
  if (error) {
    const resposta = (error as { context?: Response }).context
    const corpo = resposta ? await resposta.json().catch(() => null) : null
    throw new Error(corpo?.error ?? 'Não foi possível falar com o servidor de avisos.')
  }
  return data as T
}

export function useTelegramStatus() {
  return useQuery({
    queryKey: TELEGRAM_STATUS_KEY,
    queryFn: () => chamarFuncao<TelegramStatus>({ tipo: 'status' }),
    retry: false,
  })
}

export const ativarBot = () => chamarFuncao<{ ok: true }>({ tipo: 'configurar' })
export const enviarTeste = (destinoId: string) => chamarFuncao<{ ok: true }>({ tipo: 'teste', destino_id: destinoId })
export const enviarResumoAgora = () =>
  chamarFuncao<{ data: string; enviadas: number; falhas: { destino: string; motivo: string }[] }>({ tipo: 'pendencias' })
