// Edge Function: manage-user
// Ações administrativas sobre contas que exigem a service_role key (por isso
// não podem rodar no cliente): criar conta, redefinir senha. Editar
// nome/role/setor de uma conta já existente NÃO passa por aqui — isso é um
// simples `update` em `profiles`, coberto pela policy `profiles_admin_write`
// (RLS), então o app chama o Supabase direto pra isso.
//
// Só o Administrador pode chamar — a checagem é feita aqui no servidor, não
// confiando em nada vindo do cliente. A service_role key só existe dentro
// desta função (injetada automaticamente pelo Supabase); nunca é enviada
// pro browser.
//
// Deploy: supabase functions deploy manage-user
// Chamada pelo app: supabase.functions.invoke('manage-user', { body: { action, ... } })

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface CreateAction {
  action: 'create'
  nome: string
  username: string
  password: string
  role: string
  setor: string | null
}

interface ResetPasswordAction {
  action: 'reset_password'
  userId: string
  newPassword: string
}

type Body = CreateAction | ResetPasswordAction

// supabase.functions.invoke() sempre manda um preflight OPTIONS (por causa dos
// headers Authorization/apikey/Content-Type) — sem responder a ele com estes
// headers, o navegador bloqueia a chamada real antes de ela sair.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Método não permitido' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ error: 'Não autenticado' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Cliente "como o chamador" — só pra confirmar quem é e se é Administrador.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userError } = await callerClient.auth.getUser()
  if (userError || !userData.user) {
    return json({ error: 'Não autenticado' }, 401)
  }

  const { data: callerProfile } = await callerClient
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single()

  if (callerProfile?.role !== 'administrador') {
    return json({ error: 'Apenas Administrador pode gerenciar contas' }, 403)
  }

  const body = (await req.json()) as Body
  // Cliente com privilégio de admin — só existe aqui dentro.
  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  if (body.action === 'create') {
    if (!body.nome || !body.username || !body.password || !body.role) {
      return json({ error: 'Campos obrigatórios faltando' }, 400)
    }
    if (body.role !== 'administrador' && !body.setor) {
      return json({ error: 'Setor é obrigatório para este perfil' }, 400)
    }

    const email = `${body.username}@abz.local`
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        nome: body.nome,
        username: body.username,
        role: body.role,
        setor: body.role === 'administrador' ? '' : body.setor,
        status: 'ativa',
      },
    })

    if (createError) {
      return json({ error: createError.message }, 400)
    }
    return json({ id: created.user?.id })
  }

  if (body.action === 'reset_password') {
    if (!body.userId || !body.newPassword || body.newPassword.length < 6) {
      return json({ error: 'Senha inválida (mínimo 6 caracteres)' }, 400)
    }
    const { error: updateError } = await adminClient.auth.admin.updateUserById(body.userId, {
      password: body.newPassword,
    })
    if (updateError) {
      return json({ error: updateError.message }, 400)
    }
    return json({ ok: true })
  }

  return json({ error: 'Ação desconhecida' }, 400)
})
