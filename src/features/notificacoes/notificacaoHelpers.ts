import type { NotificacaoDestinoRow } from '../../types/database'

// Sem 0/O/1/I: o código é digitado no Telegram, lido de uma tela.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const CODIGO_VALIDADE_MIN = 30

// "ABZ-" + 5 caracteres sorteados com crypto (não Math.random): é um código de acesso.
export function gerarCodigoAtivacao(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(5))
  return `ABZ-${Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join('')}`
}

export function expiracaoDoCodigo(agora: Date = new Date()): string {
  return new Date(agora.getTime() + CODIGO_VALIDADE_MIN * 60_000).toISOString()
}

export type SituacaoDestino = 'conectado' | 'aguardando' | 'codigo_expirado'

// Conectado = já tem chat; senão, espera o /ativar dentro da validade do código.
export function situacaoDestino(d: Pick<NotificacaoDestinoRow, 'chat_id' | 'codigo_ativacao' | 'codigo_expira_em'>, agora: Date = new Date()): SituacaoDestino {
  if (d.chat_id != null) return 'conectado'
  if (d.codigo_ativacao && d.codigo_expira_em && new Date(d.codigo_expira_em) > agora) return 'aguardando'
  return 'codigo_expirado'
}

export function rotuloSetorDestino(setor: NotificacaoDestinoRow['setor']): string {
  return setor ?? 'Todos os setores'
}
