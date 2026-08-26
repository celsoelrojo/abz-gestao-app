-- 0006_fichas_tecnicas.sql
-- Taxonomia reutilizável (categoria/subcategoria "pode adicionar", por
-- setor) — mesmo padrão usado em Fichas Técnicas, Fichas de Produção e
-- Estoque no protótipo (fichaCategoriasPorSetor / estoqueCategoriasPorSetor
-- etc.), agora numa tabela só.
create table public.taxonomias (
  id uuid primary key default gen_random_uuid(),
  modulo text not null check (modulo in ('ficha_tecnica', 'ficha_producao', 'estoque')),
  setor text not null,   -- texto livre: cobre tanto o enum setor (Bar/Cozinha/Salão) quanto as categorias extras do Estoque (Material de Limpeza/Outros)
  tipo text not null check (tipo in ('categoria', 'subcategoria')),
  valor text not null,
  unique (modulo, setor, tipo, valor)
);

alter table public.taxonomias enable row level security;

create policy "taxonomias_select_all"
  on public.taxonomias for select using (true);

create policy "taxonomias_manager_insert"
  on public.taxonomias for insert
  with check (public.is_admin() or (public.is_setor_manager() and setor = public.user_setor()::text));

-- ------------------------------------------------------------
-- Fichas Técnicas: receita final (drink/prato), Administrador ou Gestor do
-- próprio setor criam/editam; só Administrador exclui. Bar/Cozinha (perfil
-- de setor) só leem publicada do próprio setor — e sem os campos de custo,
-- que aqui é serve-side (view), não só esconder no front.
-- ------------------------------------------------------------
create type public.ficha_status as enum ('rascunho', 'publicada', 'inativa');

create table public.fichas_tecnicas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  setor text not null check (setor in ('Bar', 'Cozinha')),
  codigo text,
  categoria text,
  subcategoria text,
  foto_principal_url text,
  ingredientes jsonb not null default '[]',  -- [{nome, qtdBruta, qtdLiquida, unidade, fatorCorrecao, qtdBase, precoBase}]
  embalagem numeric(10,2),
  preco_sugerido numeric(10,2),
  etapas jsonb not null default '[]',        -- [{titulo, descricao, imagens: [url,...]}]
  utensilios text,
  equipamentos text,
  padrao_apresentacao text,
  boas_praticas text,
  epis text,
  tempo_preparo text,
  alergenicos text,
  info_nutricional text,
  observacoes_gerais text,
  padrao_qualidade text,
  criterios_reprovacao text,
  vinculos jsonb not null default '[]',      -- [{tipo, id}] Mapa/POP/Ficha Técnica relacionados
  criado_por text,
  criado_em date not null default current_date,
  ultima_revisao_em date,
  publicado_por text,
  publicado_em timestamptz,
  versao integer not null default 1,
  status public.ficha_status not null default 'rascunho',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger fichas_tecnicas_set_updated_at
  before update on public.fichas_tecnicas
  for each row execute function public.set_updated_at();

alter table public.fichas_tecnicas enable row level security;

create policy "fichas_tecnicas_select"
  on public.fichas_tecnicas for select
  using (
    public.is_admin()
    or (public.is_setor_manager() and setor = public.user_setor()::text)
    or (status = 'publicada' and setor = public.user_setor()::text)
  );

create policy "fichas_tecnicas_manager_insert"
  on public.fichas_tecnicas for insert
  with check (public.is_admin() or (public.is_setor_manager() and setor = public.user_setor()::text));

create policy "fichas_tecnicas_manager_update"
  on public.fichas_tecnicas for update
  using (public.is_admin() or (public.is_setor_manager() and setor = public.user_setor()::text))
  with check (public.is_admin() or (public.is_setor_manager() and setor = public.user_setor()::text));

create policy "fichas_tecnicas_admin_delete"
  on public.fichas_tecnicas for delete
  using (public.is_admin());

-- View sem custos (embalagem/preço sugerido, e sem qtdBase/precoBase dentro
-- de cada ingrediente) — o app usa ESTA view pra Bartender/Cozinheiro, e a
-- tabela base só pra Administrador/Gestor. Herda a RLS da tabela base (não é
-- security definer), então nunca vaza ficha de outro setor ou rascunho.
create view public.fichas_tecnicas_sem_custo as
  select
    id, nome, setor, codigo, categoria, subcategoria, foto_principal_url,
    (select jsonb_agg(jsonb_build_object(
        'nome', i->>'nome', 'qtdBruta', i->'qtdBruta', 'qtdLiquida', i->'qtdLiquida',
        'unidade', i->>'unidade', 'fatorCorrecao', i->'fatorCorrecao'
      )) from jsonb_array_elements(ingredientes) i) as ingredientes,
    etapas, utensilios, equipamentos, padrao_apresentacao, boas_praticas, epis, tempo_preparo,
    alergenicos, info_nutricional, observacoes_gerais, padrao_qualidade, criterios_reprovacao,
    vinculos, criado_por, criado_em, ultima_revisao_em, publicado_por, publicado_em, versao, status
  from public.fichas_tecnicas
  where status = 'publicada';
