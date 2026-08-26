-- 0001_profiles_rls.sql
-- Perfis de usuário + funções de permissão reutilizadas em todas as demais
-- migrations. Espelha 1:1 isFullAdmin()/isSetorManager()/isManager(setor) do
-- protótipo (abz-gestao/script.js).

create extension if not exists "pgcrypto";

create type public.user_role as enum (
  'administrador',
  'gestor_bar',
  'gestor_cozinha',
  'gestor_salao',
  'bar',
  'cozinha',
  'salao'
);

create type public.setor as enum ('Bar', 'Cozinha', 'Salão');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  username text not null unique,
  role public.user_role not null,
  setor public.setor, -- null para administrador (acesso a todos os setores)
  status text not null default 'pendente' check (status in ('ativa', 'pendente', 'bloqueada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint setor_obrigatorio_para_nao_admin check (
    (role = 'administrador' and setor is null) or
    (role <> 'administrador' and setor is not null)
  )
);

comment on table public.profiles is 'Um registro por usuário autenticado (auth.users). Fonte única de role/setor para RLS.';

-- ------------------------------------------------------------
-- Funções de permissão (SECURITY DEFINER pra poder ler profiles de dentro
-- de policies sem entrar em recursão de RLS).
-- ------------------------------------------------------------
create or replace function public.current_role_name()
returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'administrador' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_setor_manager()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select role in ('gestor_bar', 'gestor_cozinha', 'gestor_salao')
    from public.profiles where id = auth.uid()
  ), false);
$$;

create or replace function public.user_setor()
returns public.setor
language sql stable security definer set search_path = public as $$
  select setor from public.profiles where id = auth.uid();
$$;

-- Equivalente a isManager(setor) do protótipo: Administrador sempre passa;
-- Gestor de setor só quando target_setor bate com o próprio (ou nenhum foi
-- pedido — checagem genérica "isto é alguém de gestão?").
create or replace function public.is_manager(target_setor public.setor default null)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or (
    public.is_setor_manager() and (target_setor is null or public.user_setor() = target_setor)
  );
$$;

-- Helper genérico de "updated_at", reaproveitado em todas as tabelas.
create or replace function public.set_updated_at()
returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Cria o profile automaticamente quando uma conta é criada no Supabase Auth.
-- role/setor/nome/username vêm de user_metadata (definidos pelo Administrador
-- ao convidar/criar a conta pela tela Gerenciar Contas).
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome, username, role, setor, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', new.email),
    coalesce(new.raw_user_meta_data->>'username', new.email),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'salao'),
    nullif(new.raw_user_meta_data->>'setor', '')::public.setor,
    coalesce(new.raw_user_meta_data->>'status', 'pendente')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- RLS: todo mundo lê o próprio profile (precisa saber a própria role/setor
-- pra UI decidir o que mostrar); só o Administrador lê/edita os demais.
-- ------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

create policy "profiles_admin_write"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "profiles_admin_delete"
  on public.profiles for delete
  using (public.is_admin());

-- Insert é feito pelo trigger handle_new_user (security definer), não
-- diretamente pelo cliente — sem policy de insert, fica bloqueado por padrão.

-- ------------------------------------------------------------
-- Login por "usuário" (não e-mail), preservando a UX do protótipo. O
-- Supabase Auth exige e-mail; a convenção é criar a conta com
-- `<username>@abz.local` (ou um e-mail real, tanto faz — só o profile.username
-- precisa ser único). Esta função roda ANTES do login (anon), então só expõe
-- o e-mail correspondente a um username existente — nunca senha nem outros
-- dados; o app faz supabase.auth.signInWithPassword({ email: <resultado>, password }).
-- ------------------------------------------------------------
create or replace function public.email_for_username(p_username text)
returns text
language sql stable security definer set search_path = public, auth as $$
  select u.email
  from auth.users u
  join public.profiles p on p.id = u.id
  where p.username = p_username;
$$;

grant execute on function public.email_for_username(text) to anon, authenticated;
