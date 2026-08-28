-- 0026_checklist_resumo_dia.sql
-- Duas barras de progresso na Home ("tarefas gerais do estabelecimento" e
-- "tarefas do meu setor") — pedido do usuário. checklist_tasks_select_own_setor
-- só deixa cada perfil enxergar o PRÓPRIO setor (migration 0002), então a
-- barra geral (todos os setores somados) não dá pra montar direto no client.
--
-- Em vez de duplicar a lógica de agendamento (isTaskScheduledOn, em
-- scheduling.ts — periodicidade/dias/semanas_do_mes) aqui em SQL, essas duas
-- funções SECURITY DEFINER só abrem uma frincha mínima na RLS: devolvem os
-- campos de AGENDA (não título/descrição/responsável) de toda tarefa ativa
-- de todo setor, e quais tarefas têm conclusão numa data — o client
-- continua calculando "agendada hoje?" com a mesma função já testada
-- (scheduling.test.ts), só que agora sobre tarefas de todos os setores.
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
  where active = true;
$$;

grant execute on function public.checklist_agenda_todos_setores() to authenticated;

create or replace function public.checklist_concluidas_em(p_data date)
returns table (task_id bigint, setor public.setor)
language sql security definer set search_path = public stable as $$
  select c.task_id, t.setor
  from public.checklist_conclusoes c
  join public.checklist_tasks t on t.id = c.task_id
  where c.data_referencia = p_data;
$$;

grant execute on function public.checklist_concluidas_em(date) to authenticated;
