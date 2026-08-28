-- 0028_fichas_producao_delete_set_null.sql
-- Bug relatado pelo usuário: Administrador não conseguia excluir uma Ficha
-- de Produção. Causa real: nenhuma das FKs que apontam pra ela (ou pros
-- lotes dela) tinha ON DELETE definido — Postgres usa NO ACTION por padrão,
-- que bloqueia o delete com "violates foreign key constraint" sempre que
-- existe QUALQUER linha relacionada (uma tarefa do Checklist vinculada, um
-- produto do Estoque com essa ficha como "ficha de preparo", ou histórico de
-- conclusões/movimentos/impressão de algum lote dela). fichas_producao_lotes
-- já tinha CASCADE (lotes somem com a ficha, correto). Nas outras, SET NULL
-- em vez de CASCADE: a linha relacionada (tarefa, produto, conclusão,
-- movimento de estoque, job de impressão) é histórico/config que deve
-- sobreviver à exclusão da ficha, só perde a referência.
alter table public.checklist_tasks
  drop constraint checklist_tasks_producao_fk,
  add constraint checklist_tasks_producao_fk
    foreign key (producao_vinculada_id) references public.fichas_producao(id) on delete set null;

alter table public.checklist_conclusoes
  drop constraint conclusoes_lote_fk,
  add constraint conclusoes_lote_fk
    foreign key (lote_id) references public.fichas_producao_lotes(id) on delete set null;

alter table public.estoque_movimentos
  drop constraint estoque_movimentos_lote_id_fkey,
  add constraint estoque_movimentos_lote_id_fkey
    foreign key (lote_id) references public.fichas_producao_lotes(id) on delete set null;

alter table public.print_jobs
  drop constraint print_jobs_lote_id_fkey,
  add constraint print_jobs_lote_id_fkey
    foreign key (lote_id) references public.fichas_producao_lotes(id) on delete set null;

alter table public.estoque_itens
  drop constraint estoque_itens_ficha_producao_id_fkey,
  add constraint estoque_itens_ficha_producao_id_fkey
    foreign key (ficha_producao_id) references public.fichas_producao(id) on delete set null;
