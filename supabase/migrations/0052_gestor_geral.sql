-- 0052_gestor_geral.sql
-- Perfil Gestor Geral (valor de enum criado na 0051).
--
--   * Acesso: igual ao do Administrador. is_admin() passa a valer pros dois,
--     então toda policy/função que já usa is_admin()/is_manager() vale pro
--     Gestor Geral sem mexer em nenhuma delas. is_super_admin() é só o
--     Administrador (decide pedidos de exclusão, contas de gestão).
--   * Apagar: o Gestor Geral não apaga nada nas tabelas abaixo. Um gatilho
--     BEFORE DELETE cancela a exclusão e grava um pedido em
--     solicitacoes_exclusao; só o Administrador aprova (e aí o registro é
--     apagado) ou recusa. Vale no banco, não só na tela.
--   * Contas: o Gestor Geral não cria nem altera Administrador/Gestor Geral
--     (senão poderia se promover) — policy de profiles + função manage-user.

-- ------------------------------------------------------------
-- Funções de permissão
-- ------------------------------------------------------------
create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'administrador' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('administrador', 'gestor_geral') from public.profiles where id = auth.uid()), false);
$$;

-- ------------------------------------------------------------
-- Perfil sem setor (acesso a todos), como o Administrador
-- ------------------------------------------------------------
alter table public.profiles drop constraint setor_obrigatorio_para_nao_admin;
alter table public.profiles add constraint setor_obrigatorio_para_nao_admin check (
  status <> 'ativa'
  or (role in ('administrador', 'gestor_geral') and setor is null)
  or (role not in ('administrador', 'gestor_geral') and setor is not null)
);

-- Contas: Gestor Geral edita as dos outros perfis, nunca as de gestão — nem
-- consegue gravar role de gestão (a policy confere a linha antes e depois).
drop policy "profiles_admin_write" on public.profiles;
create policy "profiles_admin_write"
  on public.profiles for update
  using (public.is_super_admin() or (public.is_admin() and role not in ('administrador', 'gestor_geral')))
  with check (public.is_super_admin() or (public.is_admin() and role not in ('administrador', 'gestor_geral')));

drop policy "profiles_admin_delete" on public.profiles;
create policy "profiles_admin_delete"
  on public.profiles for delete
  using (public.is_super_admin());

-- Responsáveis disponíveis no Checklist: o Gestor Geral aparece pra todos os setores.
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
    where (p.setor = p_setor or p.role in ('administrador', 'gestor_geral'))
      and p.status = 'ativa'
    order by p.nome;
end;
$$;

-- ------------------------------------------------------------
-- Pedidos de exclusão
-- ------------------------------------------------------------
create table public.solicitacoes_exclusao (
  id uuid primary key default gen_random_uuid(),
  tabela text not null,
  registro_id text not null,
  -- Texto que identifica o registro ("Conta a pagar – Energia"), pra decidir sem abrir nada.
  descricao text not null,
  -- Cópia da linha no momento do pedido (o Administrador vê o que seria apagado).
  dados jsonb not null,
  solicitante_id uuid references public.profiles(id) on delete set null,
  solicitante_nome text not null,
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'recusada')),
  resolvido_por uuid references public.profiles(id) on delete set null,
  resolvido_por_nome text,
  resolvido_em timestamptz,
  resposta text,
  created_at timestamptz not null default now()
);

-- Um registro não acumula pedidos pendentes repetidos.
create unique index solicitacoes_exclusao_pendente_uq
  on public.solicitacoes_exclusao (tabela, registro_id) where status = 'pendente';
create index solicitacoes_exclusao_status_idx on public.solicitacoes_exclusao (status, created_at desc);

-- Só leitura pelo cliente: o Administrador vê tudo, cada um vê os próprios.
-- Criar e decidir pedidos só pelo gatilho e por resolver_exclusao (security definer).
alter table public.solicitacoes_exclusao enable row level security;
create policy "solicitacoes_exclusao_select"
  on public.solicitacoes_exclusao for select
  using (public.is_super_admin() or solicitante_id = auth.uid());

create trigger audit_solicitacoes_exclusao after insert or update on public.solicitacoes_exclusao
  for each row execute function public.audit_trigger_fn();

alter publication supabase_realtime add table public.solicitacoes_exclusao;

-- ------------------------------------------------------------
-- Gatilho: o Gestor Geral não apaga — pede.
-- Devolver NULL num BEFORE DELETE pula a exclusão da linha sem erro (o app
-- do Gestor Geral continua normalmente e é avisado do pedido por realtime).
-- Nome começa com "a_" pra rodar antes de qualquer outro gatilho da tabela.
-- ------------------------------------------------------------
create or replace function public.interceptar_exclusao_gestor_geral()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_dados jsonb := to_jsonb(old);
  v_id text := v_dados->>'id';
  v_desc text;
  v_nome text;
begin
  if public.current_role_name() is distinct from 'gestor_geral' then
    return old;
  end if;

  v_desc := case tg_table_name
    when 'cardapios' then 'Cardápio da semana de ' || coalesce(v_dados->>'semana_inicio', '?')
    when 'freelancer_escalas' then 'Escala de freelancer em ' || coalesce(v_dados->>'data', '?') || ' (' || coalesce(v_dados->>'periodo', '?') || ')'
    when 'mensagens' then left(coalesce(v_dados->>'content', ''), 80)
    when 'pedidos_compra' then 'Pedido de compra – ' || coalesce(v_dados->>'fornecedor', '?') || ' (' || coalesce(v_dados->>'data_entrega', '?') || ')'
    when 'taxonomias' then coalesce(v_dados->>'modulo', '') || ' – ' || coalesce(v_dados->>'tipo', '') || ': ' || coalesce(v_dados->>'valor', '')
    else coalesce(
      nullif(v_dados->>'nome', ''), nullif(v_dados->>'titulo', ''), nullif(v_dados->>'title', ''),
      nullif(v_dados->>'descricao', ''), nullif(v_dados->>'name', '')
    )
  end;

  select nome into v_nome from public.profiles where id = auth.uid();

  insert into public.solicitacoes_exclusao (tabela, registro_id, descricao, dados, solicitante_id, solicitante_nome)
  values (tg_table_name, v_id, left(coalesce(nullif(v_desc, ''), v_id), 200), v_dados, auth.uid(), coalesce(v_nome, '—'))
  on conflict (tabela, registro_id) where status = 'pendente' do nothing;

  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'checklist_tasks', 'cardapios', 'mensagens', 'mapa_blocks', 'mapas_fluxogramas',
    'freelancer_escalas', 'pedidos_compra', 'taxonomias', 'estoque_itens', 'fichas_producao',
    'pop_categories', 'contas_pagar', 'pops', 'requisicoes', 'fichas_tecnicas'
  ] loop
    execute format(
      'create trigger a_interceptar_exclusao_gestor_geral before delete on public.%I
         for each row execute function public.interceptar_exclusao_gestor_geral()', t);
  end loop;
end $$;

-- Arquivos (fotos, anexos): o Gestor Geral também não remove — senão apagaria
-- o anexo de um registro que continua existindo. Policy restritiva vale junto
-- com as permissivas já existentes.
create policy "storage_gestor_geral_nao_apaga"
  on storage.objects as restrictive for delete to authenticated
  using (public.current_role_name() is distinct from 'gestor_geral');

-- ------------------------------------------------------------
-- Decisão do Administrador
-- ------------------------------------------------------------
create or replace function public.resolver_exclusao(p_id uuid, p_aprovar boolean, p_resposta text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_sol public.solicitacoes_exclusao;
  v_nome text;
begin
  if not public.is_super_admin() then
    raise exception 'Apenas o Administrador decide pedidos de exclusão';
  end if;

  select * into v_sol from public.solicitacoes_exclusao where id = p_id and status = 'pendente' for update;
  if not found then
    raise exception 'Este pedido não está mais pendente';
  end if;

  if p_aprovar then
    begin
      -- tabela vem do gatilho (tg_table_name), nunca do cliente; %I ainda a escapa.
      execute format('delete from public.%I where id::text = $1', v_sol.tabela) using v_sol.registro_id;
    exception when foreign_key_violation then
      raise exception 'Não foi possível apagar: o registro ainda é usado em outra parte do sistema.';
    end;
  end if;

  select nome into v_nome from public.profiles where id = auth.uid();
  update public.solicitacoes_exclusao
    set status = case when p_aprovar then 'aprovada' else 'recusada' end,
        resolvido_por = auth.uid(),
        resolvido_por_nome = v_nome,
        resolvido_em = now(),
        resposta = nullif(trim(coalesce(p_resposta, '')), '')
    where id = p_id;

  return v_sol.dados;
end;
$$;

revoke all on function public.resolver_exclusao(uuid, boolean, text) from public, anon;
grant execute on function public.resolver_exclusao(uuid, boolean, text) to authenticated;
