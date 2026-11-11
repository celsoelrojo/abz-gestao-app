-- 0053_notificacoes_telegram.sql
-- Avisos do Checklist no Telegram pros gestores e o dono.
--
--   * notificacao_destinos: grupos/pessoas que recebem (cada um com setor opcional
--     e liga/desliga de "tarefa concluída" e "pendências do dia").
--   * Cada conclusão em checklist_conclusoes chama a Edge Function
--     notificar-telegram (pg_net) — de forma assíncrona e à prova de falha: se o
--     aviso não sair, a tarefa continua concluída normalmente.
--   * Todo dia às 5h05 (Brasília = 08:05 UTC) o pg_cron pede o resumo do dia
--     operacional que acabou de fechar (o expediente vira às 5h).
--   * A URL da função e o segredo ficam em config_interna (sem policy: o app não
--     lê); são gravados à parte, fora do git, na hora de ativar.

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Configuração só do servidor (RLS ligada e sem nenhuma policy = ninguém lê pela API).
create table public.config_interna (
  chave text primary key,
  valor text not null
);
alter table public.config_interna enable row level security;

create table public.notificacao_destinos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  -- null = recebe os avisos de todos os setores (dono / gestão geral).
  setor public.setor,
  chat_id bigint unique,
  chat_nome text,
  avisar_conclusoes boolean not null default true,
  avisar_pendencias boolean not null default true,
  ativo boolean not null default true,
  -- Código de uso único (30 min) que o grupo digita no Telegram: /ativar CODIGO.
  codigo_ativacao text unique,
  codigo_expira_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notificacao_destinos enable row level security;
create policy "notificacao_destinos_admin_all"
  on public.notificacao_destinos for all
  using (public.is_admin())
  with check (public.is_admin());

create trigger notificacao_destinos_set_updated_at
  before update on public.notificacao_destinos
  for each row execute function public.set_updated_at();

create trigger audit_notificacao_destinos after insert or update or delete on public.notificacao_destinos
  for each row execute function public.audit_trigger_fn();

-- O Gestor Geral não apaga direto: vira pedido de autorização (0052).
create trigger a_interceptar_exclusao_gestor_geral before delete on public.notificacao_destinos
  for each row execute function public.interceptar_exclusao_gestor_geral();

-- ------------------------------------------------------------
-- Chamada da Edge Function
-- ------------------------------------------------------------
create or replace function public.disparar_telegram(p_corpo jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_url text;
  v_segredo text;
begin
  select valor into v_url from public.config_interna where chave = 'notificar_telegram_url';
  select valor into v_segredo from public.config_interna where chave = 'notify_secret';
  -- Ainda não ativado: não faz nada (e não atrapalha ninguém).
  if v_url is null or v_segredo is null then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_segredo),
    body := p_corpo
  );
end;
$$;

revoke all on function public.disparar_telegram(jsonb) from public, anon, authenticated;

create or replace function public.trg_notificar_conclusao()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform public.disparar_telegram(jsonb_build_object('tipo', 'conclusao', 'conclusao_id', new.id));
  exception when others then
    null; -- aviso é secundário: nunca pode impedir a conclusão da tarefa
  end;
  return new;
end;
$$;

create trigger notificar_conclusao_telegram
  after insert on public.checklist_conclusoes
  for each row execute function public.trg_notificar_conclusao();

-- Resumo diário das pendências: 05:05 em Brasília (UTC-3, sem horário de verão).
select cron.schedule(
  'telegram-pendencias-diarias',
  '5 8 * * *',
  $$select public.disparar_telegram('{"tipo":"pendencias"}'::jsonb)$$
);
