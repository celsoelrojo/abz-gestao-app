-- 0004_mapas_fluxogramas.sql
-- Mapas e Fluxogramas têm exatamente a mesma estrutura e as mesmas regras no
-- protótipo (título + setor + blocos ordenáveis; Gestor cria/edita/reordena
-- o próprio setor, só Administrador exclui) — uma tabela com `kind` evita
-- duplicar schema e policies.

create table public.mapas_fluxogramas (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('mapa', 'fluxograma')),
  setor public.setor not null,
  title text not null,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger mapas_fluxogramas_set_updated_at
  before update on public.mapas_fluxogramas
  for each row execute function public.set_updated_at();

create table public.mapa_blocks (
  id uuid primary key default gen_random_uuid(),
  mapa_id uuid not null references public.mapas_fluxogramas(id) on delete cascade,
  type text not null check (type in ('text', 'image')),
  title text not null default '',
  content text,     -- só quando type = 'text'
  image_url text,   -- só quando type = 'image' (bucket mapas-imagens)
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  constraint conteudo_por_tipo check (
    (type = 'text' and content is not null) or (type = 'image' and image_url is not null)
  )
);

alter table public.mapas_fluxogramas enable row level security;
alter table public.mapa_blocks enable row level security;

create policy "mapas_fluxogramas_select_own_setor"
  on public.mapas_fluxogramas for select
  using (public.is_admin() or setor = public.user_setor());

create policy "mapas_fluxogramas_manager_insert"
  on public.mapas_fluxogramas for insert
  with check (public.is_manager(setor));

create policy "mapas_fluxogramas_manager_update"
  on public.mapas_fluxogramas for update
  using (public.is_manager(setor))
  with check (public.is_manager(setor));

create policy "mapas_fluxogramas_admin_delete"
  on public.mapas_fluxogramas for delete
  using (public.is_admin());

create policy "mapa_blocks_select"
  on public.mapa_blocks for select
  using (exists (
    select 1 from public.mapas_fluxogramas m
    where m.id = mapa_id and (public.is_admin() or m.setor = public.user_setor())
  ));

create policy "mapa_blocks_manager_insert"
  on public.mapa_blocks for insert
  with check (exists (select 1 from public.mapas_fluxogramas m where m.id = mapa_id and public.is_manager(m.setor)));

create policy "mapa_blocks_manager_update"
  on public.mapa_blocks for update
  using (exists (select 1 from public.mapas_fluxogramas m where m.id = mapa_id and public.is_manager(m.setor)))
  with check (exists (select 1 from public.mapas_fluxogramas m where m.id = mapa_id and public.is_manager(m.setor)));

create policy "mapa_blocks_admin_delete"
  on public.mapa_blocks for delete
  using (exists (select 1 from public.mapas_fluxogramas m where m.id = mapa_id and public.is_admin()));
