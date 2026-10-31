-- 0048_requisicoes.sql
-- Pedido do usuário: módulo "Requisição" — o funcionário pede compras ou
-- consertos fora da rotina (um ventilador que quebrou, um lixo novo).
--
-- Quem abre: qualquer perfil logado, menos freelancer.
-- Quem vê: quem abriu; o Gestor do setor de quem abriu; o Administrador.
-- Quem decide (aprovar / recusar / concluir): só o Administrador.
-- O solicitante ainda edita ou cancela a própria requisição ENQUANTO ela está
-- pendente — depois que o Administrador decide, ela fica congelada.
create table public.requisicoes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('compra', 'conserto')),
  titulo text not null check (btrim(titulo) <> ''),
  descricao text,
  urgencia text not null default 'media' check (urgencia in ('baixa', 'media', 'alta')),
  foto_path text,
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'concluida', 'recusada')),
  motivo_recusa text,
  -- Preenchidos por trigger (nunca confiar no que o client manda):
  solicitante_id uuid references public.profiles(id) on delete set null default auth.uid(),
  solicitante_nome text not null default '',
  setor public.setor, -- setor de quem abriu; null quando quem abriu é o Administrador
  decidido_por_nome text,
  decidido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint requisicao_recusa_com_motivo check (status <> 'recusada' or btrim(coalesce(motivo_recusa, '')) <> '')
);

create index requisicoes_solicitante_idx on public.requisicoes (solicitante_id);
create index requisicoes_setor_idx on public.requisicoes (setor);
create index requisicoes_foto_idx on public.requisicoes (foto_path) where foto_path is not null;

create trigger requisicoes_set_updated_at
  before update on public.requisicoes
  for each row execute function public.set_updated_at();

-- Campos que o client não decide:
--  INSERT: solicitante/setor/status de quem está logado, sempre "pendente".
--  UPDATE: quem não é Administrador não mexe em status, recusa, autoria nem
--          setor (a RLS já limita ao dono + pendente; aqui fecha o resto);
--          o Administrador, ao mudar o status, carimba quem decidiu e quando.
create or replace function public.requisicoes_guard()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_nome text;
begin
  select nome into v_nome from public.profiles where id = auth.uid();

  if tg_op = 'INSERT' then
    new.solicitante_id := auth.uid();
    new.solicitante_nome := coalesce(v_nome, '');
    new.setor := public.user_setor();
    new.status := 'pendente';
    new.motivo_recusa := null;
    new.decidido_por_nome := null;
    new.decidido_em := null;
    return new;
  end if;

  new.solicitante_id := old.solicitante_id;
  new.solicitante_nome := old.solicitante_nome;
  new.setor := old.setor;

  if not public.is_admin() then
    new.status := old.status;
    new.motivo_recusa := old.motivo_recusa;
    new.decidido_por_nome := old.decidido_por_nome;
    new.decidido_em := old.decidido_em;
  elsif new.status is distinct from old.status then
    new.decidido_por_nome := v_nome;
    new.decidido_em := now();
    if new.status <> 'recusada' then
      new.motivo_recusa := null;
    end if;
  end if;
  return new;
end;
$$;

create trigger requisicoes_guard_trg
  before insert or update on public.requisicoes
  for each row execute function public.requisicoes_guard();

alter table public.requisicoes enable row level security;

-- Freelancer fica de fora de tudo (mesmo critério dos outros módulos). Anônimo:
-- current_role_name() é null, a comparação dá null e a policy nega.
create policy "requisicoes_select"
  on public.requisicoes for select
  using (
    public.current_role_name() <> 'freelancer'
    and (
      public.is_admin()
      or solicitante_id = auth.uid()
      or (setor is not null and public.is_manager(setor))
    )
  );

create policy "requisicoes_insert"
  on public.requisicoes for insert
  with check (public.current_role_name() <> 'freelancer' and solicitante_id = auth.uid());

create policy "requisicoes_update"
  on public.requisicoes for update
  using (
    public.current_role_name() <> 'freelancer'
    and (public.is_admin() or (solicitante_id = auth.uid() and status = 'pendente'))
  )
  with check (
    public.is_admin() or (solicitante_id = auth.uid() and status = 'pendente')
  );

create policy "requisicoes_delete"
  on public.requisicoes for delete
  using (
    public.current_role_name() <> 'freelancer'
    and (public.is_admin() or (solicitante_id = auth.uid() and status = 'pendente'))
  );

create trigger audit_requisicoes after insert or update or delete on public.requisicoes
  for each row execute function public.audit_trigger_fn();

alter publication supabase_realtime add table public.requisicoes;

-- ------------------------------------------------------------
-- Foto opcional (bucket privado). Caminho: `<id de quem sobe>/<arquivo>`.
-- Quem sobe só escreve na própria pasta; ler a foto = poder ver a requisição
-- que a referencia (a RLS da tabela decide, então o Gestor do setor e o
-- Administrador enxergam sem regra extra aqui).
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('requisicoes-fotos', 'requisicoes-fotos', false)
on conflict (id) do nothing;

create policy "requisicoes_fotos_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'requisicoes-fotos'
    and public.current_role_name() <> 'freelancer'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "requisicoes_fotos_select"
  on storage.objects for select
  using (
    bucket_id = 'requisicoes-fotos'
    and ((storage.foldername(name))[1] = auth.uid()::text
         or exists (select 1 from public.requisicoes r where r.foto_path = storage.objects.name))
  );

create policy "requisicoes_fotos_delete"
  on storage.objects for delete
  using (
    bucket_id = 'requisicoes-fotos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );
