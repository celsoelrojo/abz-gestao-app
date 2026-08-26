-- 0005_pops.sql
-- POP's: documento estruturado em 12 seções, exclusivo do Administrador pra
-- criar/editar/publicar/revisar/excluir; Bar/Cozinha/Salão só leem POP's
-- publicados do próprio setor + os de setor 'Geral'.
--
-- Simplificação deliberada desta fundação: as seções repetíveis
-- (responsabilidades, materiais, etapas, ações corretivas, anexos, histórico)
-- ficam em colunas JSONB em vez de 6 tabelas filhas — são exibidas como lista,
-- não precisam de query relacional própria. Pode virar tabela normalizada
-- depois se precisar filtrar/buscar dentro delas.

create type public.pop_status as enum ('rascunho', 'publicada', 'inativa');

create table public.pop_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  ordem integer not null default 0
);

create table public.pops (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  codigo text,
  setor text not null check (setor in ('Bar', 'Cozinha', 'Salão', 'Geral')),
  category_id uuid references public.pop_categories(id),
  subcategoria text,
  estabelecimento text not null default 'Abrazo Drink Bar',
  elaborado_por text,
  aprovado_por text,
  data_emissao date not null default current_date,
  versao integer not null default 1,
  ultima_revisao_em date not null default current_date,
  proxima_revisao text,
  status public.pop_status not null default 'rascunho',
  publicado_por text,
  publicado_em timestamptz,
  objetivo text not null default '',
  aplicacao text not null default '',
  setores_aplicaveis text[] not null default '{}',
  aplica_a_todos boolean not null default false,
  responsabilidades jsonb not null default '[]',   -- [{cargo, responsabilidade}]
  materiais jsonb not null default '[]',            -- [{descricao}]
  etapas jsonb not null default '[]',               -- [{titulo, descricao, tempo, temperatura, frequencia, observacao, foto_url}]
  seguranca text not null default '',
  frequencia text not null default '',
  monitoramento text not null default '',
  acoes_corretivas jsonb not null default '[]',
  anexos jsonb not null default '[]',               -- [{nome, url}] — arquivos no bucket pop-anexos
  historico jsonb not null default '[]',            -- [{data, tipo, autor}]
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger pops_set_updated_at
  before update on public.pops
  for each row execute function public.set_updated_at();

alter table public.pop_categories enable row level security;
alter table public.pops enable row level security;

create policy "pop_categories_select_all"
  on public.pop_categories for select using (true);

create policy "pop_categories_admin_write"
  on public.pop_categories for all
  using (public.is_admin()) with check (public.is_admin());

-- Administrador vê tudo (qualquer status/setor); os demais só publicada, do
-- próprio setor ou 'Geral'.
create policy "pops_select"
  on public.pops for select
  using (
    public.is_admin()
    or (status = 'publicada' and (setor = 'Geral' or setor = public.user_setor()::text))
  );

create policy "pops_admin_write"
  on public.pops for all
  using (public.is_admin()) with check (public.is_admin());
