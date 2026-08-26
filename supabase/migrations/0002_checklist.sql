-- 0002_checklist.sql
-- Módulo Checklist — tarefas recorrentes/únicas + histórico real de
-- conclusões (substitui o campo único lastCompletedDate do protótipo por uma
-- linha por conclusão, o que também dá histórico de atraso/antecipação de
-- graça e é a base pro Realtime "conclusão aparece na hora pro gestor").

create type public.periodicidade as enum (
  'Diária', 'Semanal', 'Quinzenal', 'Mensal', 'A cada turno', 'Única'
);

create type public.weekday as enum (
  'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'
);

create table public.checklist_tasks (
  id bigint generated always as identity primary key,
  setor public.setor not null,
  title text not null,
  description text not null default '',
  responsavel_nome text not null,
  periodicidade public.periodicidade not null default 'Diária',
  dias public.weekday[] not null default '{}',       -- só relevante fora de 'Única'
  data_unica date,                                     -- só relevante em 'Única'
  semanas_do_mes text[] not null default '{}',         -- '1'..'5' | 'ultima' — só Mensal/Quinzenal
  vinculo_tipo text,                                    -- 'Mapa' | 'Fluxograma' | 'POP' | 'Ficha Técnica' | 'Ficha de Produção'
  vinculo_id uuid,                                      -- referência polimórfica (mesmo padrão do protótipo)
  envolve_producao boolean not null default false,
  producao_vinculada_id uuid,                           -- fk pra fichas_producao, adicionada na migration 0007
  foto_obrigatoria boolean not null default false,
  freelancer_pagamento boolean not null default false,
  freelancer_escala_id uuid,                            -- fk pra freelancer_escalas, adicionada na migration 0010
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint data_unica_exigida check (periodicidade <> 'Única' or data_unica is not null)
);

create trigger checklist_tasks_set_updated_at
  before update on public.checklist_tasks
  for each row execute function public.set_updated_at();

comment on table public.checklist_tasks is 'Definição da tarefa (agenda). Conclusões ficam em checklist_conclusoes — uma linha por dia concluído.';

create table public.checklist_conclusoes (
  id uuid primary key default gen_random_uuid(),
  task_id bigint not null references public.checklist_tasks(id) on delete cascade,
  data_referencia date not null,                        -- dia que a conclusão "vale" (= targetDate do protótipo)
  completed_by uuid not null references public.profiles(id),
  completed_at timestamptz not null default now(),
  foto_url text,                                         -- caminho no bucket checklist-fotos
  justificativa_atraso text,
  antecipacao_data_programada date,
  antecipacao_justificativa text,
  lote_id uuid,                                          -- fk pra fichas_producao_lotes, adicionada na 0007
  movimento_estoque_id uuid,                              -- fk pra estoque_movimentos, adicionada na 0008
  created_at timestamptz not null default now(),
  unique (task_id, data_referencia)
);

comment on table public.checklist_conclusoes is 'Uma linha = uma tarefa concluída num dia. Apagar = "desmarcar" (só permitido no próprio dia pela regra de negócio da UI).';

-- ------------------------------------------------------------
-- RLS — mesma regra do protótipo: qualquer perfil vê/atua nas tarefas do
-- próprio setor; Administrador vê/atua em tudo; só quem gerencia
-- (isManager(setor)) cria/edita/exclui a DEFINIÇÃO da tarefa.
-- ------------------------------------------------------------
alter table public.checklist_tasks enable row level security;

create policy "checklist_tasks_select_own_setor"
  on public.checklist_tasks for select
  using (public.is_admin() or setor = public.user_setor());

create policy "checklist_tasks_manager_write"
  on public.checklist_tasks for all
  using (public.is_manager(setor))
  with check (public.is_manager(setor));

alter table public.checklist_conclusoes enable row level security;

create policy "conclusoes_select_own_setor"
  on public.checklist_conclusoes for select
  using (exists (
    select 1 from public.checklist_tasks t
    where t.id = task_id and (public.is_admin() or t.setor = public.user_setor())
  ));

-- Concluir tarefa: qualquer perfil do próprio setor (não só gestor) — espelha
-- toggleTaskComplete() do protótipo, que qualquer role de setor pode chamar.
create policy "conclusoes_insert_own_setor"
  on public.checklist_conclusoes for insert
  with check (
    completed_by = auth.uid()
    and exists (
      select 1 from public.checklist_tasks t
      where t.id = task_id and (public.is_admin() or t.setor = public.user_setor())
    )
  );

-- "Desmarcar" (apagar a conclusão) — mesma regra de quem pode concluir.
create policy "conclusoes_delete_own_setor"
  on public.checklist_conclusoes for delete
  using (exists (
    select 1 from public.checklist_tasks t
    where t.id = task_id and (public.is_admin() or t.setor = public.user_setor())
  ));

-- Realtime: INSERT/DELETE em conclusões precisa chegar pro gestor na hora.
alter publication supabase_realtime add table public.checklist_conclusoes;
