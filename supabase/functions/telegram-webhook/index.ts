// Edge Function: telegram-webhook
// Recebe do Telegram as mensagens enviadas ao bot. Só entende `/ativar CODIGO`:
// quem tem o código gerado na tela Notificações conecta aquele grupo (ou conversa
// privada) a um destino de avisos. O resto é ignorado ou respondido com instrução.
//
// O Telegram prova que a chamada é dele pelo header X-Telegram-Bot-Api-Secret-Token
// (o mesmo NOTIFY_SECRET, definido no setWebhook feito por notificar-telegram
// 'configurar'). verify_jwt = false (config.toml).
//
// Deploy: supabase functions deploy telegram-webhook

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function responder(token: string, chatId: number, texto: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: texto }),
  }).catch(() => undefined)
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok')

  const segredo = Deno.env.get('NOTIFY_SECRET') ?? ''
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''
  if (!segredo || !token || !iguais(req.headers.get('x-telegram-bot-api-secret-token') ?? '', segredo)) {
    return new Response('unauthorized', { status: 401 })
  }

  const update = (await req.json().catch(() => null)) as {
    message?: { text?: string; chat: { id: number; type: string; title?: string; first_name?: string } }
  } | null
  const msg = update?.message
  if (!msg?.text) return new Response('ok')

  const [comando, ...resto] = msg.text.trim().split(/\s+/)
  const cmd = comando.toLowerCase().replace(/@.*$/, '')
  const chatId = msg.chat.id

  if (cmd === '/start') {
    await responder(
      token,
      chatId,
      'Olá! Eu sou o bot de avisos do Abz Gestão.\nPara receber os avisos do Checklist aqui, peça um código ao Administrador (tela Notificações do app) e envie: /ativar CODIGO',
    )
    return new Response('ok')
  }

  if (cmd === '/ativar') {
    const codigo = (resto[0] ?? '').toUpperCase()
    if (!codigo) {
      await responder(token, chatId, 'Envie o código junto: /ativar CODIGO')
      return new Response('ok')
    }
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: destino } = await admin
      .from('notificacao_destinos')
      .select('id, nome')
      .eq('codigo_ativacao', codigo)
      .gt('codigo_expira_em', new Date().toISOString())
      .maybeSingle()
    if (!destino) {
      await responder(token, chatId, 'Código inválido ou expirado. Gere um novo na tela Notificações do app.')
      return new Response('ok')
    }
    const { error } = await admin
      .from('notificacao_destinos')
      .update({
        chat_id: chatId,
        chat_nome: msg.chat.title ?? msg.chat.first_name ?? null,
        codigo_ativacao: null,
        codigo_expira_em: null,
      })
      .eq('id', destino.id)
    if (error) {
      // chat_id é único: este chat já está ligado a outro destino.
      await responder(token, chatId, 'Este chat já está conectado a outro destino de avisos.')
      return new Response('ok')
    }
    await responder(token, chatId, `✅ Conectado: "${destino.nome}". Os avisos do Checklist vão chegar aqui.`)
  }

  return new Response('ok')
})
