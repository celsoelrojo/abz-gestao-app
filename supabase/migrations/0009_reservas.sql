-- 0009_reservas.sql
-- Reservas: Administrador e Gestor de Salão têm CRUD completo; Atendente
-- (setor Salão) só lê, e sem telefone/e-mail/Instagram — por isso a view
-- reservas_sem_contato, que o app usa pro perfil Atendente.

create type public.reserva_periodo as enum ('Almoço', 'Noite');

create table public.reservas (
  id uuid primary key default gen_random_uuid(),
  nome_cliente text not null,
  telefone text,
  email text,
  instagram text,
  origem text,
  data date not null,
  horario time,
  periodo public.reserva_periodo not null,
  quantidade_pessoas integer not null,
  mesa text,
  ocasiao text,
  observacoes text,
  restricoes text,
  responsavel text,
  status text not null default 'Confirmada',
  sinal text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger reservas_set_updated_at
  before update on public.reservas
  for each row execute function public.set_updated_at();

create table public.reserva_capacidade (
  periodo public.reserva_periodo primary key,
  capacidade integer not null
);
insert into public.reserva_capacidade (periodo, capacidade) values ('Almoço', 40), ('Noite', 60);

alter table public.reservas enable row level security;
alter table public.reserva_capacidade enable row level security;

-- Leitura: Administrador + qualquer perfil do setor Salão (Gestor e
-- Atendente) — a diferença de telefone/Instagram é feita pela view abaixo,
-- não pela policy (ambos precisam ver a reserva em si).
create policy "reservas_select"
  on public.reservas for select
  using (public.is_admin() or public.user_setor() = 'Salão');

-- "+ Nova Reserva" e edição: exclusivo Administrador/Gestor de Salão.
create policy "reservas_manager_write"
  on public.reservas for all
  using (public.is_admin() or (public.is_setor_manager() and public.user_setor() = 'Salão'))
  with check (public.is_admin() or (public.is_setor_manager() and public.user_setor() = 'Salão'));

create policy "reserva_capacidade_select"
  on public.reserva_capacidade for select using (true);

create policy "reserva_capacidade_manager_write"
  on public.reserva_capacidade for all
  using (public.is_admin() or (public.is_setor_manager() and public.user_setor() = 'Salão'))
  with check (public.is_admin() or (public.is_setor_manager() and public.user_setor() = 'Salão'));

alter publication supabase_realtime add table public.reservas;

create view public.reservas_sem_contato as
  select id, nome_cliente, data, horario, periodo, quantidade_pessoas, mesa, ocasiao,
         observacoes, restricoes, responsavel, status, origem, created_at, updated_at
  from public.reservas;
