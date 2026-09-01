-- 0037_checklist_responsavel_turno.sql
-- Pedido do usuário: 1) "Responsável" da tarefa deixa de ser texto livre e
-- passa a ser vinculado a um usuário já cadastrado; 2) campo novo "Turno"
-- (Almoço/Noite, reaproveitando o enum reserva_periodo já criado em 0009).
--
-- responsavel_id é opcional a nível de banco (tarefas antigas ficam com
-- null até alguém reabrir e escolher um responsável de verdade) — quem
-- exige preenchido pra tarefa NOVA é a tela (ManageChecklistModal), igual
-- o padrão já usado noutros campos "obrigatórios só daqui pra frente" desta
-- app. responsavel_nome continua existindo (passa a ser preenchido a partir
-- do nome do profile escolhido) porque é lido em vários lugares que exibem
-- a tarefa — trocar por join em todo canto seria um raio bem maior sem
-- necessidade.
alter table public.checklist_tasks
  add column responsavel_id uuid references public.profiles(id),
  add column turno public.reserva_periodo;

-- profiles_select_own_or_admin (migration 0001) só deixa cada um ler o
-- próprio profile (ou o Administrador ler todo mundo) — um Gestor de setor
-- não consegue listar os colegas do próprio setor pra escolher como
-- responsável. Esta função devolve só o mínimo necessário (id + nome),
-- restrita a quem já gerencia aquele setor (mesma checagem de
-- is_manager(setor) usada em checklist_tasks_manager_write).
create or replace function public.checklist_responsaveis_disponiveis(p_setor public.setor)
returns table(id uuid, nome text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_manager(p_setor) then
    raise exception 'Sem permissão para ver responsáveis deste setor';
  end if;
  return query
    select p.id, p.nome
    from public.profiles p
    where (p.setor = p_setor or p.role = 'administrador')
      and p.status = 'ativa'
    order by p.nome;
end;
$$;

grant execute on function public.checklist_responsaveis_disponiveis(public.setor) to authenticated;
