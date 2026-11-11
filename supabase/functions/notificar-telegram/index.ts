// Edge Function: notificar-telegram
// Manda os avisos do Checklist pros grupos/pessoas cadastrados em
// notificacao_destinos (tela Notificações). Dois jeitos de chamar:
//
//   * Pelo banco (pg_net, migration 0053), com `Authorization: Bearer
//     <NOTIFY_SECRET>`: { tipo: 'conclusao', conclusao_id } a cada tarefa
//     concluída, e { tipo: 'pendencias' } às 5h05 (resumo do dia que fechou).
//   * Pelo app, como Administrador/Gestor Geral logado: { tipo: 'status' |
//     'configurar' | 'teste' | 'pendencias' }.
//
// Segredos (supabase secrets set): TELEGRAM_BOT_TOKEN (do @BotFather) e
// NOTIFY_SECRET (aleatório, também gravado em config_interna pra o banco chamar).
// verify_jwt = false (config.toml): o banco não tem JWT de usuário, então a
// autenticação é feita aqui, no código.
//
// Deploy: supabase functions deploy notificar-telegram

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  diaOperacionalIso,
  mensagemConclusao,
  mensagemPendencias,
  pendentesDoDia,
  somarDiasIso,
  tarefaAgendadaEm,
  dataEmBrasilia,
  type TarefaDoDia,
} from '../_shared/agenda.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

// Comparação sem atalho por tamanho/posição (o segredo não vaza por tempo de resposta).
function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

interface Destino {
  id: string
  nome: string
  setor: string | null
  chat_id: number | null
}

interface RespostaTelegram {
  ok: boolean
  result?: unknown
  description?: string
}

async function telegram(token: string, metodo: string, corpo: Record<string, unknown> = {}): Promise<RespostaTelegram> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${metodo}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    })
    return (await r.json()) as RespostaTelegram
  } catch (err) {
    return { ok: false, description: err instanceof Error ? err.message : 'falha de rede' }
  }
}

async function enviar(token: string, destinos: { chat_id: number | null; nome: string; texto: string }[]) {
  const falhas: { destino: string; motivo: string }[] = []
  let enviadas = 0
  for (const d of destinos) {
    if (d.chat_id == null) continue
    const r = await telegram(token, 'sendMessage', {
      chat_id: d.chat_id,
      text: d.texto,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    })
    if (r.ok) enviadas++
    else falhas.push({ destino: d.nome, motivo: r.description ?? 'erro desconhecido' })
  }
  return { enviadas, falhas }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const segredo = Deno.env.get('NOTIFY_SECRET') ?? ''
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''
  const authHeader = req.headers.get('Authorization') ?? ''
  const bearer = authHeader.replace(/^Bearer\s+/i, '')

  // Quem chama: o banco (segredo) ou uma pessoa de administração logada.
  const doBanco = segredo !== '' && iguais(bearer, segredo)
  let doApp = false
  if (!doBanco) {
    if (!authHeader) return json({ error: 'Não autenticado' }, 401)
    const callerClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
    const { data: userData, error: userError } = await callerClient.auth.getUser()
    if (userError || !userData.user) return json({ error: 'Não autenticado' }, 401)
    const { data: perfil } = await callerClient.from('profiles').select('role').eq('id', userData.user.id).single()
    doApp = perfil?.role === 'administrador' || perfil?.role === 'gestor_geral'
    if (!doApp) return json({ error: 'Apenas Administrador ou Gestor Geral' }, 403)
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const tipo = String(body.tipo ?? '')
  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  if (!token) {
    // Sem o bot configurado não há o que enviar; pro banco isso não é erro (a tarefa já foi salva).
    return json({ error: 'O bot do Telegram ainda não foi configurado (falta TELEGRAM_BOT_TOKEN no servidor).' }, doApp ? 503 : 200)
  }

  // ---------------- Ações da tela (só pessoa logada) ----------------
  if (doApp && tipo === 'status') {
    const eu = await telegram(token, 'getMe')
    if (!eu.ok) return json({ error: `Token do bot inválido: ${eu.description ?? ''}` }, 400)
    const hook = await telegram(token, 'getWebhookInfo')
    const esperado = `${supabaseUrl}/functions/v1/telegram-webhook`
    const info = (hook.result ?? {}) as { url?: string; last_error_message?: string }
    return json({
      bot: (eu.result as { username?: string }).username ?? null,
      webhook_ativo: info.url === esperado,
      ultimo_erro: info.last_error_message ?? null,
    })
  }

  if (doApp && tipo === 'configurar') {
    if (!segredo) return json({ error: 'Falta NOTIFY_SECRET no servidor.' }, 503)
    const r = await telegram(token, 'setWebhook', {
      url: `${supabaseUrl}/functions/v1/telegram-webhook`,
      secret_token: segredo,
      allowed_updates: ['message'],
      drop_pending_updates: true,
    })
    return r.ok ? json({ ok: true }) : json({ error: r.description ?? 'Não foi possível ativar o bot.' }, 400)
  }

  if (doApp && tipo === 'teste') {
    const { data: d } = await admin.from('notificacao_destinos').select('id, nome, chat_id').eq('id', String(body.destino_id ?? '')).single()
    if (!d || d.chat_id == null) return json({ error: 'Este destino ainda não está conectado.' }, 400)
    const r = await enviar(token, [{ chat_id: d.chat_id, nome: d.nome, texto: '🔔 Teste do Abz Gestão: este chat vai receber os avisos do Checklist.' }])
    return r.enviadas > 0 ? json({ ok: true }) : json({ error: r.falhas[0]?.motivo ?? 'Não foi possível enviar.' }, 400)
  }

  // ---------------- Avisos (banco ou botão "enviar agora") ----------------
  if (tipo === 'conclusao' && doBanco) {
    const { data: c } = await admin
      .from('checklist_conclusoes')
      .select('task_id, completed_by, completed_at, foto_url, justificativa_atraso_days_late')
      .eq('id', String(body.conclusao_id ?? ''))
      .single()
    if (!c) return json({ ok: true, enviadas: 0 })
    const { data: t } = await admin.from('checklist_tasks').select('title, setor').eq('id', c.task_id).single()
    if (!t) return json({ ok: true, enviadas: 0 })
    const { data: p } = c.completed_by ? await admin.from('profiles').select('nome').eq('id', c.completed_by).single() : { data: null }

    const { data: destinos } = await admin
      .from('notificacao_destinos')
      .select('id, nome, setor, chat_id')
      .eq('ativo', true)
      .eq('avisar_conclusoes', true)
      .not('chat_id', 'is', null)
    const texto = mensagemConclusao({
      titulo: t.title,
      setor: t.setor,
      por: p?.nome ?? null,
      concluidaEm: c.completed_at,
      diasAtraso: c.justificativa_atraso_days_late,
      comFoto: !!c.foto_url,
    })
    const alvos = ((destinos ?? []) as Destino[]).filter((d) => d.setor === null || d.setor === t.setor)
    return json(await enviar(token, alvos.map((d) => ({ ...d, texto }))))
  }

  if (tipo === 'pendencias') {
    // O dia que acabou de fechar (o expediente vira às 5h): ontem, em dia operacional.
    const dataIso = typeof body.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.data) ? body.data : somarDiasIso(diaOperacionalIso(new Date()), -1)

    const { data: tarefas } = await admin
      .from('checklist_tasks')
      .select('id, title, setor, periodicidade, dias, data_unica, semanas_do_mes, active, created_at')
      .eq('active', true)
    const { data: concluidas } = await admin.from('checklist_conclusoes').select('task_id').eq('data_referencia', dataIso)
    const feitas = new Set((concluidas ?? []).map((c: { task_id: number }) => c.task_id))
    const todas = (tarefas ?? []) as TarefaDoDia[]
    const existiam = todas.filter((t) => dataEmBrasilia(t.created_at) <= dataIso && tarefaAgendadaEm(t, dataIso))

    const { data: destinos } = await admin
      .from('notificacao_destinos')
      .select('id, nome, setor, chat_id')
      .eq('ativo', true)
      .eq('avisar_pendencias', true)
      .not('chat_id', 'is', null)

    const mensagens = ((destinos ?? []) as Destino[]).map((d) => {
      const agendadas: Record<string, number> = {}
      for (const t of existiam) if (d.setor === null || d.setor === t.setor) agendadas[t.setor] = (agendadas[t.setor] ?? 0) + 1
      const pendentes = pendentesDoDia(todas, feitas, dataIso).filter((t) => d.setor === null || d.setor === t.setor)
      return { ...d, texto: mensagemPendencias(dataIso, agendadas, pendentes) }
    })
    return json({ data: dataIso, ...(await enviar(token, mensagens)) })
  }

  return json({ error: 'Ação desconhecida' }, 400)
})
