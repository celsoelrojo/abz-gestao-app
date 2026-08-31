-- 0036_freelancer_login.sql
-- Perfil de login pra freelancers — decisões tomadas com o usuário:
-- 1) além de ver a própria escala, o freelancer completa o Checklist do
--    setor, mas só nos dias em que está de fato escalado;
-- 2) ele NÃO vê o valor do próprio pagamento (isso fica só pra Gestor/Admin).
--
-- `freelancers.profile_id` liga o cadastro (tabela já existente, sem login)
-- a uma conta real — a ligação é feita em Gerenciar Contas ao criar a conta
-- (ver ContasPage.tsx), não aqui.
alter table public.freelancers
  add column profile_id uuid references public.profiles(id),
  add constraint freelancers_profile_id_unique unique (profile_id);

-- ------------------------------------------------------------
-- Freelancer lê o PRÓPRIO cadastro e a PRÓPRIA escala (não a de outros —
-- freelancers_admin_only/freelancer_escalas_admin_only continuam cobrindo
-- o Administrador via "for all"; isto aqui é só mais uma policy de select).
-- ------------------------------------------------------------
create policy "freelancers_select_own"
  on public.freelancers for select
  using (profile_id = auth.uid());

create policy "freelancer_escalas_select_own"
  on public.freelancer_escalas for select
  using (exists (
    select 1 from public.freelancers f where f.id = freelancer_id and f.profile_id = auth.uid()
  ));

-- ------------------------------------------------------------
-- checklist_tasks/checklist_conclusoes: a tarefa "Pagar freelancer" (criada
-- automaticamente pelo trigger da migration 0010) tem o valor do pagamento
-- embutido na descrição — isso nunca pode chegar num freelancer, mesmo que
-- o setor bata. As duas policies de SELECT abaixo substituem as de 0002,
-- acrescentando só essa exclusão (Administrador/Gestor/demais perfis de
-- setor continuam vendo tudo do próprio setor, sem mudança de comportamento).
-- ------------------------------------------------------------
drop policy "checklist_tasks_select_own_setor" on public.checklist_tasks;
create policy "checklist_tasks_select_own_setor"
  on public.checklist_tasks for select
  using (
    public.is_admin()
    or (setor = public.user_setor() and not (freelancer_pagamento and public.current_role_name() = 'freelancer'))
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
  ));

-- Só é escalado se existir uma linha de freelancer_escalas pra ESSE dia e
-- ESSE setor, pertencendo ao freelancer ligado ao usuário logado.
create or replace function public.is_freelancer_escalado(p_setor public.setor, p_data date)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.freelancer_escalas fe
    join public.freelancers f on f.id = fe.freelancer_id
    where f.profile_id = auth.uid() and fe.setor = p_setor and fe.data = p_data
  );
$$;

-- Concluir/desmarcar tarefa: pra qualquer perfil de setor não-freelancer,
-- comportamento idêntico ao de antes (só dividido em dois "or" pra abrir
-- espaço pro terceiro, específico do freelancer). Freelancer só completa
-- tarefa comum (nunca 'Pagar freelancer') e só no dia em que está escalado
-- naquele setor.
drop policy "conclusoes_insert_own_setor" on public.checklist_conclusoes;
create policy "conclusoes_insert_own_setor"
  on public.checklist_conclusoes for insert
  with check (
    completed_by = auth.uid()
    and exists (
      select 1 from public.checklist_tasks t
      where t.id = task_id
        and (
          public.is_admin()
          or (t.setor = public.user_setor() and public.current_role_name() <> 'freelancer')
          or (
            t.setor = public.user_setor() and public.current_role_name() = 'freelancer'
            and not t.freelancer_pagamento
            and public.is_freelancer_escalado(t.setor, data_referencia)
          )
        )
    )
  );

drop policy "conclusoes_delete_own_setor" on public.checklist_conclusoes;
create policy "conclusoes_delete_own_setor"
  on public.checklist_conclusoes for delete
  using (exists (
    select 1 from public.checklist_tasks t
    where t.id = task_id
      and (
        public.is_admin()
        or (t.setor = public.user_setor() and public.current_role_name() <> 'freelancer')
        or (
          t.setor = public.user_setor() and public.current_role_name() = 'freelancer'
          and not t.freelancer_pagamento
          and public.is_freelancer_escalado(t.setor, data_referencia)
        )
      )
  ));
