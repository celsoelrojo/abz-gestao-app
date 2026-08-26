-- 0007_fichas_producao.sql
-- Fichas de Produção (preparos base, ex.: xaropes/molhos) + lotes (batches),
-- e as FKs que ficaram pendentes em checklist_tasks/checklist_conclusoes
-- (migration 0002) até esta tabela existir.

create table public.fichas_producao (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  setor text not null check (setor in ('Bar', 'Cozinha')),
  codigo text,
  categoria text,  -- lista fechada (Base/Molho/Xarope/Calda/Guarnição/Pré-preparo/Mise en place/Outro), validada no app
  ingredientes jsonb not null default '[]',  -- [{nome, tipo: 'base'|'secundario'|'variavel', qtd, unidade}]
  etapas jsonb not null default '[]',
  prazo_validade numeric,
  unidade_validade text check (unidade_validade in ('Horas', 'Dias', 'Semanas', 'Meses')),
  condicao_armazenamento text,
  temp_min numeric,
  temp_max numeric,
  tipo_recipiente text,
  qtd_recipientes text,
  validade_apos_aberto text,
  validade_apos_descongelamento text,
  instrucoes_etiqueta text,
  instrucoes_descarte text,
  status public.ficha_status not null default 'rascunho',
  versao integer not null default 1,
  criado_por text,
  publicado_por text,
  publicado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger fichas_producao_set_updated_at
  before update on public.fichas_producao
  for each row execute function public.set_updated_at();

create table public.fichas_producao_lotes (
  id uuid primary key default gen_random_uuid(),
  ficha_id uuid not null references public.fichas_producao(id) on delete cascade,
  numero_lote text not null,
  data_hora_producao timestamptz not null,
  responsavel text not null,
  quantidade_produzida text not null,
  data_hora_validade timestamptz,
  justificativa_alteracao text,
  observacao text,
  foto_url text,
  created_at timestamptz not null default now()
);

-- Completa as FKs polimórficas deixadas pendentes na migration 0002.
alter table public.checklist_tasks
  add constraint checklist_tasks_producao_fk foreign key (producao_vinculada_id) references public.fichas_producao(id);
alter table public.checklist_conclusoes
  add constraint conclusoes_lote_fk foreign key (lote_id) references public.fichas_producao_lotes(id);

alter table public.fichas_producao enable row level security;
alter table public.fichas_producao_lotes enable row level security;

create policy "fichas_producao_select"
  on public.fichas_producao for select
  using (
    public.is_admin()
    or (public.is_setor_manager() and setor = public.user_setor()::text)
    or (status = 'publicada' and setor = public.user_setor()::text)
  );

create policy "fichas_producao_manager_insert"
  on public.fichas_producao for insert
  with check (public.is_admin() or (public.is_setor_manager() and setor = public.user_setor()::text));

create policy "fichas_producao_manager_update"
  on public.fichas_producao for update
  using (public.is_admin() or (public.is_setor_manager() and setor = public.user_setor()::text))
  with check (public.is_admin() or (public.is_setor_manager() and setor = public.user_setor()::text));

create policy "fichas_producao_admin_delete"
  on public.fichas_producao for delete
  using (public.is_admin());

-- Lotes são criados na conclusão de uma tarefa de produção — qualquer perfil
-- do setor (não só gestor) pode gerar um lote, mesma regra de quem conclui
-- tarefas do Checklist.
create policy "lotes_select"
  on public.fichas_producao_lotes for select
  using (exists (
    select 1 from public.fichas_producao f
    where f.id = ficha_id and (public.is_admin() or f.setor = public.user_setor()::text)
  ));

create policy "lotes_insert"
  on public.fichas_producao_lotes for insert
  with check (exists (
    select 1 from public.fichas_producao f
    where f.id = ficha_id and (public.is_admin() or f.setor = public.user_setor()::text)
  ));
