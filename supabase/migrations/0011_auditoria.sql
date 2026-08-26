-- 0011_auditoria.sql
-- Log de auditoria genérico via trigger — não depende do app lembrar de
-- registrar nada; qualquer INSERT/UPDATE/DELETE nas tabelas críticas é
-- capturado automaticamente com quem fez, quando, e o antes/depois.

create table public.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id text not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  actor_id uuid references public.profiles(id),
  actor_nome text,
  changed_at timestamptz not null default now(),
  old_data jsonb,
  new_data jsonb
);

create index audit_log_table_record_idx on public.audit_log (table_name, record_id);
create index audit_log_changed_at_idx on public.audit_log (changed_at desc);

alter table public.audit_log enable row level security;

create policy "audit_log_admin_select"
  on public.audit_log for select
  using (public.is_admin());
-- Sem policy de insert pro client — só o trigger (security definer) escreve.

create or replace function public.audit_trigger_fn()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_record_id text;
begin
  v_record_id := coalesce((case when TG_OP = 'DELETE' then old.id else new.id end)::text, '');
  insert into public.audit_log (table_name, record_id, action, actor_id, actor_nome, old_data, new_data)
  values (
    TG_TABLE_NAME, v_record_id, TG_OP, auth.uid(),
    (select nome from public.profiles where id = auth.uid()),
    case when TG_OP <> 'INSERT' then to_jsonb(old) else null end,
    case when TG_OP <> 'DELETE' then to_jsonb(new) else null end
  );
  if TG_OP = 'DELETE' then return old; else return new; end if;
end;
$$;

create trigger audit_checklist_tasks after insert or update or delete on public.checklist_tasks for each row execute function public.audit_trigger_fn();
create trigger audit_checklist_conclusoes after insert or update or delete on public.checklist_conclusoes for each row execute function public.audit_trigger_fn();
create trigger audit_estoque_itens after insert or update or delete on public.estoque_itens for each row execute function public.audit_trigger_fn();
create trigger audit_estoque_movimentos after insert or update or delete on public.estoque_movimentos for each row execute function public.audit_trigger_fn();
create trigger audit_reservas after insert or update or delete on public.reservas for each row execute function public.audit_trigger_fn();
create trigger audit_freelancer_escalas after insert or update or delete on public.freelancer_escalas for each row execute function public.audit_trigger_fn();
create trigger audit_profiles after insert or update or delete on public.profiles for each row execute function public.audit_trigger_fn();
create trigger audit_pops after insert or update or delete on public.pops for each row execute function public.audit_trigger_fn();
create trigger audit_fichas_tecnicas after insert or update or delete on public.fichas_tecnicas for each row execute function public.audit_trigger_fn();
create trigger audit_fichas_producao after insert or update or delete on public.fichas_producao for each row execute function public.audit_trigger_fn();
