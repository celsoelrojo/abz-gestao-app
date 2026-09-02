-- 0038_checklist_responsavel_dia.sql
-- Pedido do usuário: trocar o responsável de UMA tarefa só naquele dia
-- (sem mexer no responsável padrão da tarefa, definido em Gerenciar
-- Checklist) — Gestor só no próprio setor, Administrador em qualquer um.
-- Mesmo padrão de "uma linha por ocorrência" já usado em
-- checklist_conclusoes: a chave é (task_id, data_referencia), então cada
-- dia tem no máximo um override, e apagar a linha volta a valer o
-- responsável padrão da tarefa.
create table public.checklist_responsavel_dia (
  task_id bigint not null references public.checklist_tasks(id) on delete cascade,
  data_referencia date not null,
  responsavel_id uuid not null references public.profiles(id),
  responsavel_nome text not null,
  alterado_por uuid references public.profiles(id),
  alterado_em timestamptz not null default now(),
  primary key (task_id, data_referencia)
);

comment on table public.checklist_responsavel_dia is 'Override do responsável de uma tarefa só pra um dia específico — sem linha aqui, vale checklist_tasks.responsavel_nome (o padrão).';

alter table public.checklist_responsavel_dia enable row level security;

create policy "checklist_responsavel_dia_select"
  on public.checklist_responsavel_dia for select
  using (exists (
    select 1 from public.checklist_tasks t
    where t.id = task_id and (public.is_admin() or t.setor = public.user_setor())
  ));

-- "for all" cobre insert/update (trocar o responsável do dia, inclusive
-- trocar de novo) e delete (voltar ao padrão) com a mesma regra: só quem
-- gerencia o setor DAQUELA tarefa (is_manager já cobre Administrador em
-- qualquer setor).
create policy "checklist_responsavel_dia_write"
  on public.checklist_responsavel_dia for all
  using (exists (select 1 from public.checklist_tasks t where t.id = task_id and public.is_manager(t.setor)))
  with check (exists (select 1 from public.checklist_tasks t where t.id = task_id and public.is_manager(t.setor)));

alter publication supabase_realtime add table public.checklist_responsavel_dia;
