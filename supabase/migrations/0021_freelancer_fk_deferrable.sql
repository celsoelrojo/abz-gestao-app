-- 0021_freelancer_fk_deferrable.sql
-- Bug real da 0010, nunca exercitado até a tela de Escala existir: o
-- trigger sync_freelancer_pagamento_task roda BEFORE INSERT em
-- freelancer_escalas e insere um checklist_tasks referenciando new.id (a
-- própria escala que ainda não foi gravada) — a FK checklist_tasks_freelancer_fk
-- não-deferrable falha na hora com "violates foreign key constraint", porque
-- a linha de freelancer_escalas só passa a existir de fato quando o INSERT
-- externo termina. Tornar a constraint DEFERRABLE INITIALLY DEFERRED adia a
-- checagem pro fim da transação, quando as duas linhas (escala + tarefa) já
-- existem.
alter table public.checklist_tasks
  drop constraint checklist_tasks_freelancer_fk,
  add constraint checklist_tasks_freelancer_fk
    foreign key (freelancer_escala_id) references public.freelancer_escalas(id)
    deferrable initially deferred;
