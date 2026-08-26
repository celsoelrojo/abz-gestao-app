-- 0010_freelancer.sql
-- Módulo Freelancer: exclusivo Administrador. Cada linha de escala
-- sincroniza automaticamente (via trigger) sua tarefa "Pagar freelancer" no
-- Checklist — isso é regra de negócio real, então fica no banco (trigger),
-- não só numa função do cliente que qualquer app poderia esquecer de chamar.

create table public.freelancers (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  setor public.setor not null,
  funcao text not null,
  telefone text not null,
  email text,
  observacoes text,
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger freelancers_set_updated_at
  before update on public.freelancers
  for each row execute function public.set_updated_at();

create table public.freelancer_escalas (
  id uuid primary key default gen_random_uuid(),
  freelancer_id uuid not null references public.freelancers(id),
  data date not null,
  setor public.setor not null,
  periodo public.reserva_periodo not null,   -- reaproveita o enum Almoço/Noite já criado em 0009
  hora_inicio time,
  hora_fim time,
  valor_pagamento numeric(10, 2),
  funcao_turno text,
  observacoes text,
  tarefa_pagamento_id bigint references public.checklist_tasks(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger freelancer_escalas_set_updated_at
  before update on public.freelancer_escalas
  for each row execute function public.set_updated_at();

alter table public.checklist_tasks
  add constraint checklist_tasks_freelancer_fk foreign key (freelancer_escala_id) references public.freelancer_escalas(id);

alter table public.freelancers enable row level security;
alter table public.freelancer_escalas enable row level security;

create policy "freelancers_admin_only"
  on public.freelancers for all
  using (public.is_admin()) with check (public.is_admin());

create policy "freelancer_escalas_admin_only"
  on public.freelancer_escalas for all
  using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- Cria/atualiza a tarefa de pagamento ao salvar uma escala. Um pagamento já
-- concluído (existe conclusão na data programada) nunca é alterado
-- retroativamente — mesma regra "antes do pagamento" do protótipo.
-- ------------------------------------------------------------
create or replace function public.sync_freelancer_pagamento_task()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_freelancer public.freelancers;
  v_hora text;
  v_title text;
  v_desc text;
  v_task_id bigint;
  v_already_paid boolean;
begin
  select * into v_freelancer from public.freelancers where id = new.freelancer_id;
  v_hora := case when new.periodo = 'Almoço' then '14h' else '20h' end;
  v_title := 'Pagar freelancer – ' || v_freelancer.nome || ' – ' || new.periodo::text;
  v_desc := 'Pagamento programado para ' || v_hora
    || case when new.valor_pagamento is not null then ' · R$ ' || to_char(new.valor_pagamento, 'FM999999990.00') else '' end
    || '. Turno: ' || coalesce(new.hora_inicio::text, '—') || '–' || coalesce(new.hora_fim::text, '—')
    || case when new.funcao_turno is not null and new.funcao_turno <> '' then ' · ' || new.funcao_turno else '' end || '.';

  if new.tarefa_pagamento_id is not null then
    select exists (
      select 1 from public.checklist_conclusoes c
      where c.task_id = new.tarefa_pagamento_id and c.data_referencia = new.data
    ) into v_already_paid;
    if v_already_paid then
      return new;
    end if;
    update public.checklist_tasks
      set title = v_title, description = v_desc, setor = new.setor, data_unica = new.data, responsavel_nome = v_freelancer.nome
      where id = new.tarefa_pagamento_id;
  else
    insert into public.checklist_tasks (setor, title, description, responsavel_nome, periodicidade, data_unica, freelancer_pagamento, freelancer_escala_id)
    values (new.setor, v_title, v_desc, v_freelancer.nome, 'Única', new.data, true, new.id)
    returning id into v_task_id;
    new.tarefa_pagamento_id := v_task_id;
  end if;
  return new;
end;
$$;

create trigger freelancer_escalas_sync_pagamento
  before insert or update on public.freelancer_escalas
  for each row execute function public.sync_freelancer_pagamento_task();

-- Ao excluir a escala: se já foi paga, só desvincula (mantém a tarefa como
-- histórico); se não foi paga, cancela (apaga) a tarefa de pagamento.
create or replace function public.cancel_freelancer_pagamento_task()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_already_paid boolean;
begin
  if old.tarefa_pagamento_id is null then return old; end if;
  select exists (
    select 1 from public.checklist_conclusoes c
    where c.task_id = old.tarefa_pagamento_id and c.data_referencia = old.data
  ) into v_already_paid;
  if v_already_paid then
    update public.checklist_tasks set freelancer_escala_id = null where id = old.tarefa_pagamento_id;
  else
    delete from public.checklist_tasks where id = old.tarefa_pagamento_id;
  end if;
  return old;
end;
$$;

create trigger freelancer_escalas_cancel_pagamento
  after delete on public.freelancer_escalas
  for each row execute function public.cancel_freelancer_pagamento_task();
