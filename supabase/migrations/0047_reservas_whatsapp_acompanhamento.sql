-- 0047_reservas_whatsapp_acompanhamento.sql
-- Pedido do usuário (formulário Nova reserva):
--  1) WhatsApp do cliente passa a ser o IDENTIFICADOR: uma reserva nova com o
--     mesmo número reconhece o cliente, e os clientes viram um banco de dados
--     (tabela `clientes`, uma linha por número).
--  2) "Primeira vez do cliente na casa" (reservas.primeira_vez).
--  3) "Observação pós-reserva" (reservas.acompanhamento_obs): quando preenchida,
--     gera uma tarefa de acompanhamento no Checklist do Salão, visível só para
--     a Gestão do Salão e o Administrador.

-- ------------------------------------------------------------
-- WhatsApp canônico: só dígitos, sem o 55 do Brasil (12–13 dígitos começando
-- com 55 viram 10–11). Menos de 10 dígitos = inválido (null). A tela faz a
-- mesma normalização (reservas/whatsapp.ts) — o banco é quem decide a chave.
-- ------------------------------------------------------------
create or replace function public.normalizar_whatsapp(p_texto text)
returns text
language sql immutable as $$
  select case
    when d ~ '^55[0-9]{10,11}$' then substr(d, 3)
    when length(d) between 10 and 15 then d
    else null
  end
  from (select regexp_replace(coalesce(p_texto, ''), '[^0-9]', '', 'g') as d) x;
$$;

-- ------------------------------------------------------------
-- Banco de clientes. Leitura só para a Gestão do Salão e o Administrador (é
-- o mesmo público que já vê o telefone nas reservas); ninguém escreve direto
-- — o trigger abaixo mantém a tabela a cada reserva salva.
-- ------------------------------------------------------------
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  whatsapp text not null unique check (whatsapp ~ '^[0-9]{10,15}$'),
  nome text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger clientes_set_updated_at
  before update on public.clientes
  for each row execute function public.set_updated_at();

alter table public.clientes enable row level security;

create policy "clientes_select_manager"
  on public.clientes for select
  using (public.is_manager('Salão'));

alter table public.reservas
  add column cliente_id uuid references public.clientes(id) on delete set null,
  add column primeira_vez boolean,
  add column acompanhamento_obs text;

-- Reservas antigas entram no banco de clientes pelo telefone que já tinham
-- (o nome mais recente de cada número). Triggers desligados só neste trecho:
-- é uma arrumação de dados, não deve virar 1 linha de auditoria por reserva
-- nem mexer em updated_at.
alter table public.reservas disable trigger user;

insert into public.clientes (whatsapp, nome)
select distinct on (w) w, nome_cliente
from (
  select public.normalizar_whatsapp(telefone) as w, btrim(nome_cliente) as nome_cliente, created_at
  from public.reservas
) r
where w is not null
order by w, created_at desc
on conflict (whatsapp) do nothing;

update public.reservas r
  set cliente_id = c.id, telefone = c.whatsapp
  from public.clientes c
  where c.whatsapp = public.normalizar_whatsapp(r.telefone);

alter table public.reservas enable trigger user;

-- A cada reserva salva: normaliza o telefone (WhatsApp), cria/atualiza o
-- cliente e liga a reserva a ele. Número inválido/ausente (reservas antigas
-- com contato em texto) fica sem cliente, sem erro.
create or replace function public.sync_reserva_cliente()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_w text;
begin
  v_w := public.normalizar_whatsapp(new.telefone);
  if v_w is null then
    new.cliente_id := null;
    return new;
  end if;
  new.telefone := v_w;
  insert into public.clientes (whatsapp, nome)
    values (v_w, btrim(new.nome_cliente))
    on conflict (whatsapp) do update set nome = excluded.nome
    returning id into new.cliente_id;
  return new;
end;
$$;

create trigger reservas_sync_cliente
  before insert or update of telefone, nome_cliente on public.reservas
  for each row execute function public.sync_reserva_cliente();

-- ------------------------------------------------------------
-- Tarefa de acompanhamento (Checklist do Salão).
-- ------------------------------------------------------------
alter table public.checklist_tasks
  add column reserva_id uuid references public.reservas(id) on delete set null;

create index checklist_tasks_reserva_idx on public.checklist_tasks (reserva_id) where reserva_id is not null;

comment on column public.checklist_tasks.reserva_id is
  'Preenchido nas tarefas "Acompanhar reserva" geradas por reservas.acompanhamento_obs (0047). Mantidas por trigger; só Gestão do Salão e Administrador enxergam.';

-- Quem enxerga: a tarefa de acompanhamento só aparece para o Administrador e o
-- Gestor do setor — o Atendente do Salão (mesmo setor) não vê. As policies de
-- SELECT de 0036 são refeitas com essa condição a mais; o resto (freelancer
-- não ver pagamento) fica igual.
drop policy "checklist_tasks_select_own_setor" on public.checklist_tasks;
create policy "checklist_tasks_select_own_setor"
  on public.checklist_tasks for select
  using (
    (
      public.is_admin()
      or (setor = public.user_setor() and not (freelancer_pagamento and public.current_role_name() = 'freelancer'))
    )
    and (reserva_id is null or public.is_manager(setor))
  );

drop policy "conclusoes_select_own_setor" on public.checklist_conclusoes;
create policy "conclusoes_select_own_setor"
  on public.checklist_conclusoes for select
  using (exists (
    select 1 from public.checklist_tasks t
    where t.id = task_id
      and (
        public.is_admin()
        or (t.setor = public.user_setor() and not (t.freelancer_pagamento and public.current_role_name() = 'freelancer'))
      )
      and (t.reserva_id is null or public.is_manager(t.setor))
  ));

-- As barras de progresso da Home (0026) usam estas duas funções SECURITY
-- DEFINER, que passam por cima da RLS: sem o filtro, o Atendente teria uma
-- tarefa "invisível" pesando no total do Salão sem poder concluí-la.
create or replace function public.checklist_agenda_todos_setores()
returns table (
  id bigint,
  setor public.setor,
  periodicidade public.periodicidade,
  dias public.weekday[],
  data_unica date,
  semanas_do_mes text[]
)
language sql security definer set search_path = public stable as $$
  select id, setor, periodicidade, dias, data_unica, semanas_do_mes
  from public.checklist_tasks
  where active = true
    and (reserva_id is null or public.is_manager(setor));
$$;

create or replace function public.checklist_concluidas_em(p_data date)
returns table (task_id bigint, setor public.setor)
language sql security definer set search_path = public stable as $$
  select c.task_id, t.setor
  from public.checklist_conclusoes c
  join public.checklist_tasks t on t.id = c.task_id
  where c.data_referencia = p_data
    and (t.reserva_id is null or public.is_manager(t.setor));
$$;

-- Mantém UMA tarefa por reserva:
--   observação preenchida (e reserva não cancelada) -> cria/atualiza, para o
--     DIA SEGUINTE à reserva (é um acompanhamento "depois da reserva")
--   observação vazia ou reserva cancelada          -> apaga a tarefa aberta
-- Tarefa já concluída nunca é alterada nem apagada (é o registro do que foi
-- feito). Não cria tarefa com data que já passou — registrar/editar uma
-- reserva antiga não pode gerar tarefa atrasada.
create or replace function public.sync_reserva_acompanhamento_task()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_task public.checklist_tasks;
  v_due date := new.data + 1;
  v_obs text := btrim(coalesce(new.acompanhamento_obs, ''));
  v_quer boolean := (btrim(coalesce(new.acompanhamento_obs, '')) <> '' and new.status <> 'cancelada');
  v_title text;
  v_desc text;
begin
  v_title := 'Acompanhar reserva – ' || new.nome_cliente || ' – ' || to_char(new.data, 'DD/MM');
  v_desc := v_obs || ' (Reserva de ' || to_char(new.data, 'DD/MM') || ', ' || new.periodo::text || ', '
    || new.quantidade_pessoas || case when new.quantidade_pessoas = 1 then ' pessoa' else ' pessoas' end
    || case when new.telefone is not null then ' · WhatsApp ' || new.telefone else '' end || '.)';

  select * into v_task from public.checklist_tasks where reserva_id = new.id;

  if found then
    if exists (select 1 from public.checklist_conclusoes c where c.task_id = v_task.id) then
      return new;
    end if;
    if v_quer then
      update public.checklist_tasks
        set title = v_title, description = v_desc, data_unica = v_due, active = true
        where id = v_task.id;
    else
      delete from public.checklist_tasks where id = v_task.id;
    end if;
  elsif v_quer and v_due >= (now() at time zone 'America/Sao_Paulo')::date then
    insert into public.checklist_tasks
      (setor, title, description, responsavel_nome, periodicidade, data_unica, reserva_id)
    values
      ('Salão', v_title, v_desc, 'Gestão do Salão', 'Única', v_due, new.id);
  end if;
  return new;
end;
$$;

create trigger reservas_sync_acompanhamento
  after insert or update on public.reservas
  for each row execute function public.sync_reserva_acompanhamento_task();

-- Ao excluir a reserva: apaga a tarefa se ainda aberta; a já concluída fica
-- como histórico (a FK `on delete set null` só solta o vínculo).
create or replace function public.cancel_reserva_acompanhamento_task()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.checklist_tasks t
    where t.reserva_id = old.id
      and not exists (select 1 from public.checklist_conclusoes c where c.task_id = t.id);
  return old;
end;
$$;

create trigger reservas_cancel_acompanhamento
  before delete on public.reservas
  for each row execute function public.cancel_reserva_acompanhamento_task();

-- ------------------------------------------------------------
-- View do Atendente (sem contato): ganha primeira_vez; continua SEM
-- cliente_id e SEM acompanhamento_obs (interno da gestão). Precisa recriar —
-- CREATE OR REPLACE VIEW só aceita colunas novas no fim e aqui só se acrescenta.
-- ------------------------------------------------------------
drop view public.reservas_sem_contato;

create view public.reservas_sem_contato as
  select id, nome_cliente, data, horario, periodo, quantidade_pessoas, mesa, ocasiao,
         observacoes, restricoes, responsavel, status, origem, sinal,
         criado_por, motivo_cancelamento, cancelada_por, cancelada_em, historico,
         created_at, updated_at, primeira_vez
  from public.reservas;
