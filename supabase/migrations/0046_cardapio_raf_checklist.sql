-- 0046_cardapio_raf_checklist.sql
-- Pedido do usuário: vincular ao Checklist da Cozinha a produção da RAF do
-- dia, com o prato. Cada dia com prato no Cardápio RAF vira UMA tarefa
-- "Produzir RAF – <prato>" no Checklist da Cozinha, só naquele dia. Dia sem
-- prato não gera tarefa.
--
-- Mesmo mecanismo do pagamento de freelancer (0010): um trigger SECURITY
-- DEFINER mantém as tarefas em sincronia ao salvar o cardápio — quem salva o
-- cardápio não precisa (nem pode, pela RLS de checklist_tasks) mexer na tarefa.

alter table public.checklist_tasks
  add column cardapio_id uuid references public.cardapios(id) on delete set null;

create index checklist_tasks_cardapio_idx on public.checklist_tasks (cardapio_id) where cardapio_id is not null;

comment on column public.checklist_tasks.cardapio_id is
  'Preenchido nas tarefas "Produzir RAF" geradas pelo Cardápio RAF (0046). Elas são mantidas pelo trigger — não aparecem em Gerenciar Checklist.';

-- Reconcilia as tarefas do cardápio com os dias que têm prato:
--   dia com prato, sem tarefa      -> cria
--   dia com prato, tarefa aberta   -> atualiza título/vínculo (prato trocado)
--   dia sem prato / removido       -> apaga a tarefa, se ainda não foi feita
-- Uma tarefa JÁ CONCLUÍDA nunca é alterada nem apagada: é o registro de que a
-- RAF daquele dia foi produzida (mesma regra do pagamento de freelancer).
create or replace function public.sync_cardapio_raf_tasks()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_dia jsonb;
  v_data date;
  v_ficha_id uuid;
  v_prato text;
  v_title text;
  v_desc text;
  v_task public.checklist_tasks;
  v_titulo_semana text;
begin
  v_titulo_semana := to_char(new.semana_inicio, 'DD/MM') || ' a ' || to_char(new.semana_inicio + 6, 'DD/MM');

  for v_dia in select * from jsonb_array_elements(new.dias) loop
    v_data := (v_dia->>'data')::date;
    v_ficha_id := nullif(v_dia->>'fichaTecnicaId', '')::uuid;
    -- nome ATUAL da ficha, se ainda existir; senão o gravado no cardápio
    select nome into v_prato from public.fichas_tecnicas where id = v_ficha_id;
    v_prato := coalesce(v_prato, v_dia->>'nome', 'prato do dia');
    v_title := 'Produzir RAF – ' || v_prato;
    v_desc := 'Produção da RAF do dia: ' || v_prato || '. Cardápio RAF, semana de ' || v_titulo_semana || '.';

    select * into v_task from public.checklist_tasks
      where cardapio_id = new.id and data_unica = v_data;

    if found then
      if not exists (
        select 1 from public.checklist_conclusoes c where c.task_id = v_task.id and c.data_referencia = v_data
      ) then
        update public.checklist_tasks
          set title = v_title, description = v_desc, vinculo_tipo = 'Ficha Técnica', vinculo_id = v_ficha_id
          where id = v_task.id;
      end if;
    elsif v_data >= (now() at time zone 'America/Sao_Paulo')::date then
      -- só cria tarefa de dia que ainda não passou: cadastrar o cardápio no meio
      -- da semana não pode gerar tarefa atrasada de dia já encerrado
      insert into public.checklist_tasks
        (setor, title, description, responsavel_nome, periodicidade, data_unica, vinculo_tipo, vinculo_id, cardapio_id)
      values
        ('Cozinha', v_title, v_desc, 'Cozinha', 'Única', v_data, 'Ficha Técnica', v_ficha_id, new.id);
    end if;
  end loop;

  -- dias que saíram do cardápio (ou ficaram sem prato): apaga a tarefa se
  -- ainda não foi concluída
  delete from public.checklist_tasks t
    where t.cardapio_id = new.id
      and not exists (
        select 1 from jsonb_array_elements(new.dias) d where (d->>'data')::date = t.data_unica
      )
      and not exists (
        select 1 from public.checklist_conclusoes c where c.task_id = t.id
      );

  return new;
end;
$$;

create trigger cardapios_sync_checklist
  after insert or update of dias on public.cardapios
  for each row execute function public.sync_cardapio_raf_tasks();

-- Ao excluir o cardápio: apaga as tarefas ainda não concluídas; as que já
-- foram feitas ficam como histórico (a FK `on delete set null` só solta o
-- vínculo com o cardápio).
create or replace function public.cancel_cardapio_raf_tasks()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.checklist_tasks t
    where t.cardapio_id = old.id
      and not exists (select 1 from public.checklist_conclusoes c where c.task_id = t.id);
  return old;
end;
$$;

create trigger cardapios_cancel_checklist
  before delete on public.cardapios
  for each row execute function public.cancel_cardapio_raf_tasks();
