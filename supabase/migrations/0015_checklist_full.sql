-- 0015_checklist_full.sql
-- Fecha o módulo Checklist: atraso/antecipação com justificativa, ordenação
-- persistida (pra "Gerenciar Checklist"), e exclusão de tarefa restrita ao
-- Administrador (Gestor de setor só desativa — espelha o protótipo).

-- ------------------------------------------------------------
-- Campos que faltavam pra guardar a justificativa de atraso por completo
-- (o protótipo guarda { texto, missedDate, daysLate, dismissedBySetorManager }
-- num único objeto; aqui vira 3 colunas, já que cada linha de
-- checklist_conclusoes é uma conclusão específica).
-- ------------------------------------------------------------
alter table public.checklist_conclusoes
  add column justificativa_atraso_missed_date date,
  add column justificativa_atraso_days_late integer,
  add column justificativa_atraso_dismissed boolean not null default false;

comment on column public.checklist_conclusoes.justificativa_atraso_missed_date is
  'Data originalmente programada que ficou sem concluir (a ocorrência "em atraso" que esta conclusão resolve).';
comment on column public.checklist_conclusoes.justificativa_atraso_dismissed is
  'true = um Gestor de setor apagou a notificação da própria visão (a justificativa em si continua existindo pro Administrador). Administrador "apagar" de verdade zera as 3 colunas via resolve_justificativa_atraso().';

-- ------------------------------------------------------------
-- Ordenação persistida — o protótipo reordena um array em memória; aqui
-- precisa de uma coluna de verdade pra sobreviver a reload/sessão nova.
-- ------------------------------------------------------------
alter table public.checklist_tasks add column posicao integer not null default 0;

with ordered as (
  select id, row_number() over (partition by setor order by id) as rn
  from public.checklist_tasks
)
update public.checklist_tasks t
set posicao = o.rn
from ordered o
where o.id = t.id;

-- ------------------------------------------------------------
-- Corrige dados de seed que ficaram com `dias` vazio pra 'A cada turno' —
-- isTaskScheduledOn (mesma regra do protótipo) exige `dias.includes(weekday)`
-- pra QUALQUER periodicidade exceto 'Única', então uma tarefa 'Diária'/'A
-- cada turno' precisa ter os 7 dias marcados pra aparecer todo dia.
-- ------------------------------------------------------------
update public.checklist_tasks
set dias = '{Segunda,Terça,Quarta,Quinta,Sexta,Sábado,Domingo}'
where periodicidade in ('Diária', 'A cada turno') and dias = '{}';

-- ------------------------------------------------------------
-- Exclusão de tarefa: só Administrador (Gestor de setor desativa via update,
-- já coberto pela policy de update abaixo). A policy "for all" antiga não
-- dava pra restringir só o delete sem afetar insert/update, então ela é
-- substituída por três policies específicas.
-- ------------------------------------------------------------
drop policy "checklist_tasks_manager_write" on public.checklist_tasks;

create policy "checklist_tasks_manager_insert"
  on public.checklist_tasks for insert
  with check (public.is_manager(setor));

create policy "checklist_tasks_manager_update"
  on public.checklist_tasks for update
  using (public.is_manager(setor))
  with check (public.is_manager(setor));

create policy "checklist_tasks_admin_delete"
  on public.checklist_tasks for delete
  using (public.is_admin());

-- ------------------------------------------------------------
-- "Apagar notificação de atraso" — mesma regra do protótipo
-- (deleteJustificativaAtraso): Administrador apaga de vez (zera as 3
-- colunas); Gestor de setor só esconde da própria visão
-- (justificativa_atraso_dismissed = true), a conclusão em si nunca muda.
-- SECURITY DEFINER porque a checagem de quem pode agir depende do setor da
-- TAREFA (join), não de uma coluna direta em checklist_conclusoes — mais
-- simples resolver aqui do que com RLS de update.
-- ------------------------------------------------------------
create or replace function public.resolve_justificativa_atraso(p_conclusao_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_setor public.setor;
begin
  select t.setor into v_setor
  from public.checklist_conclusoes c
  join public.checklist_tasks t on t.id = c.task_id
  where c.id = p_conclusao_id;

  if v_setor is null then
    raise exception 'Conclusão não encontrada';
  end if;
  if not public.is_manager(v_setor) then
    raise exception 'Sem permissão para gerenciar esta notificação';
  end if;

  if public.is_admin() then
    update public.checklist_conclusoes
      set justificativa_atraso = null,
          justificativa_atraso_missed_date = null,
          justificativa_atraso_days_late = null,
          justificativa_atraso_dismissed = false
      where id = p_conclusao_id;
  else
    update public.checklist_conclusoes
      set justificativa_atraso_dismissed = true
      where id = p_conclusao_id;
  end if;
end;
$$;

grant execute on function public.resolve_justificativa_atraso(uuid) to authenticated;
