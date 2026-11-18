-- 0055_cotacoes.sql
-- Cotação de produtos com fornecedores diferentes (Estoque e Compras).
--
-- Fluxo: a pessoa escolhe os produtos (em geral da Lista de Compras), lista os
-- fornecedores consultados, digita o preço de cada um e escolhe, por produto,
-- quem vai fornecer (o app sugere o mais barato). "Gerar pedidos" cria um
-- Pedido de Compra por fornecedor escolhido e encerra a cotação.
--
-- Administrador e Gestor Geral (is_admin()). Os dados da cotação são gravados de
-- uma vez por salvar_cotacao (transação única); o rascunho pode ser salvo e
-- retomado quantas vezes quiser até gerar os pedidos.

create table public.cotacoes (
  id uuid primary key default gen_random_uuid(),
  titulo text,
  observacoes text,
  status text not null default 'aberta' check (status in ('aberta', 'finalizada')),
  criado_por uuid references public.profiles(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  finalizada_em timestamptz
);

create table public.cotacao_fornecedores (
  id uuid primary key,
  cotacao_id uuid not null references public.cotacoes(id) on delete cascade,
  nome text not null,
  -- prazo, forma de pagamento, frete... o que ajuda a decidir além do preço.
  observacoes text,
  ordem int not null default 0
);

create table public.cotacao_itens (
  id uuid primary key,
  cotacao_id uuid not null references public.cotacoes(id) on delete cascade,
  estoque_item_id uuid references public.estoque_itens(id) on delete set null,
  -- cópia do produto no momento da cotação (sobrevive à exclusão do produto)
  produto text not null,
  categoria public.estoque_categoria not null,
  unidade public.estoque_unidade not null,
  quantidade numeric(12, 3) not null check (quantidade > 0),
  ordem int not null default 0,
  fornecedor_escolhido_id uuid references public.cotacao_fornecedores(id) on delete set null
);

create table public.cotacao_precos (
  item_id uuid not null references public.cotacao_itens(id) on delete cascade,
  fornecedor_id uuid not null references public.cotacao_fornecedores(id) on delete cascade,
  -- por unidade do estoque (fardo, litro, quilo...), igual ao custo do produto
  preco_unitario numeric(14, 4) not null check (preco_unitario >= 0),
  primary key (item_id, fornecedor_id)
);

create index cotacao_fornecedores_cotacao_idx on public.cotacao_fornecedores (cotacao_id);
create index cotacao_itens_cotacao_idx on public.cotacao_itens (cotacao_id);

alter table public.cotacoes enable row level security;
alter table public.cotacao_fornecedores enable row level security;
alter table public.cotacao_itens enable row level security;
alter table public.cotacao_precos enable row level security;

create policy "cotacoes_admin_all" on public.cotacoes for all using (public.is_admin()) with check (public.is_admin());
create policy "cotacao_fornecedores_admin_all" on public.cotacao_fornecedores for all using (public.is_admin()) with check (public.is_admin());
create policy "cotacao_itens_admin_all" on public.cotacao_itens for all using (public.is_admin()) with check (public.is_admin());
create policy "cotacao_precos_admin_all" on public.cotacao_precos for all using (public.is_admin()) with check (public.is_admin());

create trigger audit_cotacoes after insert or update or delete on public.cotacoes
  for each row execute function public.audit_trigger_fn();

-- O Gestor Geral não apaga direto: vira pedido de autorização (0052).
create trigger a_interceptar_exclusao_gestor_geral before delete on public.cotacoes
  for each row execute function public.interceptar_exclusao_gestor_geral();

-- Pedidos gerados por uma cotação ficam ligados a ela.
alter table public.pedidos_compra
  add column cotacao_id uuid references public.cotacoes(id) on delete set null;

-- ------------------------------------------------------------
-- Salvar (cria ou substitui o conteúdo de uma cotação aberta, de uma vez)
--   p_dados: { titulo, observacoes,
--              fornecedores: [{ id, nome, observacoes }],
--              itens: [{ id, estoque_item_id, produto, categoria, unidade, quantidade, fornecedor_escolhido_id }],
--              precos: [{ item_id, fornecedor_id, preco_unitario }] }
-- Os ids de fornecedor e item nascem no app (uuid), pra o rascunho poder ligar
-- preço e escolha antes de existir no banco.
-- ------------------------------------------------------------
create or replace function public.salvar_cotacao(p_id uuid, p_dados jsonb)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := p_id;
  v_status text;
  v_elem jsonb;
  v_ordem int;
begin
  if not public.is_admin() then
    raise exception 'Apenas Administrador ou Gestor Geral';
  end if;

  if v_id is null then
    insert into public.cotacoes (titulo, observacoes, criado_por)
    values (nullif(trim(coalesce(p_dados->>'titulo', '')), ''), nullif(trim(coalesce(p_dados->>'observacoes', '')), ''), auth.uid())
    returning id into v_id;
  else
    select status into v_status from public.cotacoes where id = v_id for update;
    if not found then raise exception 'Cotação não encontrada'; end if;
    if v_status = 'finalizada' then raise exception 'Esta cotação já foi finalizada'; end if;
    update public.cotacoes
      set titulo = nullif(trim(coalesce(p_dados->>'titulo', '')), ''),
          observacoes = nullif(trim(coalesce(p_dados->>'observacoes', '')), ''),
          atualizado_em = now()
      where id = v_id;
    -- Itens e fornecedores do rascunho são reescritos (preços saem junto, em cascata).
    delete from public.cotacao_itens where cotacao_id = v_id;
    delete from public.cotacao_fornecedores where cotacao_id = v_id;
  end if;

  v_ordem := 0;
  for v_elem in select value from jsonb_array_elements(coalesce(p_dados->'fornecedores', '[]'::jsonb)) loop
    insert into public.cotacao_fornecedores (id, cotacao_id, nome, observacoes, ordem)
    values ((v_elem->>'id')::uuid, v_id, trim(v_elem->>'nome'), nullif(trim(coalesce(v_elem->>'observacoes', '')), ''), v_ordem);
    v_ordem := v_ordem + 1;
  end loop;

  v_ordem := 0;
  for v_elem in select value from jsonb_array_elements(coalesce(p_dados->'itens', '[]'::jsonb)) loop
    insert into public.cotacao_itens (id, cotacao_id, estoque_item_id, produto, categoria, unidade, quantidade, ordem, fornecedor_escolhido_id)
    values (
      (v_elem->>'id')::uuid, v_id, nullif(v_elem->>'estoque_item_id', '')::uuid, v_elem->>'produto',
      (v_elem->>'categoria')::public.estoque_categoria, (v_elem->>'unidade')::public.estoque_unidade,
      (v_elem->>'quantidade')::numeric, v_ordem, nullif(v_elem->>'fornecedor_escolhido_id', '')::uuid
    );
    v_ordem := v_ordem + 1;
  end loop;

  for v_elem in select value from jsonb_array_elements(coalesce(p_dados->'precos', '[]'::jsonb)) loop
    insert into public.cotacao_precos (item_id, fornecedor_id, preco_unitario)
    values ((v_elem->>'item_id')::uuid, (v_elem->>'fornecedor_id')::uuid, (v_elem->>'preco_unitario')::numeric);
  end loop;

  return v_id;
end;
$$;

revoke all on function public.salvar_cotacao(uuid, jsonb) from public, anon;
grant execute on function public.salvar_cotacao(uuid, jsonb) to authenticated;

-- ------------------------------------------------------------
-- Gerar pedidos: um Pedido de Compra por fornecedor escolhido, com os itens
-- que ele vai fornecer (o preço cotado vai na observação do item) e o total
-- na observação do pedido. A cotação fica finalizada. Devolve quantos pedidos.
-- ------------------------------------------------------------
create or replace function public.gerar_pedidos_cotacao(p_cotacao_id uuid, p_data_entrega date)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_cot public.cotacoes;
  v_forn public.cotacao_fornecedores;
  v_pedido uuid;
  v_total numeric;
  v_qtd int := 0;
begin
  if not public.is_admin() then
    raise exception 'Apenas Administrador ou Gestor Geral';
  end if;

  select * into v_cot from public.cotacoes where id = p_cotacao_id for update;
  if not found then raise exception 'Cotação não encontrada'; end if;
  if v_cot.status = 'finalizada' then raise exception 'Esta cotação já gerou pedidos'; end if;

  if exists (
    select 1 from public.cotacao_itens i
    where i.cotacao_id = p_cotacao_id and i.fornecedor_escolhido_id is not null
      and not exists (select 1 from public.cotacao_precos p where p.item_id = i.id and p.fornecedor_id = i.fornecedor_escolhido_id)
  ) then
    raise exception 'Há item com fornecedor escolhido e sem preço informado';
  end if;

  for v_forn in
    select f.* from public.cotacao_fornecedores f
    where f.cotacao_id = p_cotacao_id
      and exists (select 1 from public.cotacao_itens i where i.fornecedor_escolhido_id = f.id)
    order by f.ordem
  loop
    select coalesce(sum(i.quantidade * p.preco_unitario), 0) into v_total
      from public.cotacao_itens i join public.cotacao_precos p on p.item_id = i.id and p.fornecedor_id = v_forn.id
      where i.fornecedor_escolhido_id = v_forn.id;

    insert into public.pedidos_compra (fornecedor, data_entrega, observacoes, criado_por, cotacao_id)
    values (
      v_forn.nome, p_data_entrega,
      'Cotação' || coalesce(' "' || v_cot.titulo || '"', '') || ' — total previsto R$ ' || replace(to_char(v_total, 'FM999999990.00'), '.', ','),
      auth.uid(), p_cotacao_id
    ) returning id into v_pedido;

    insert into public.pedidos_compra_itens (pedido_id, estoque_item_id, produto, categoria, unidade, quantidade, ordem, observacao)
    select v_pedido, i.estoque_item_id, i.produto, i.categoria, i.unidade, i.quantidade, i.ordem,
           'Cotado a R$ ' || replace(to_char(p.preco_unitario, 'FM999999990.00##'), '.', ',') || ' por ' || lower(i.unidade::text)
    from public.cotacao_itens i join public.cotacao_precos p on p.item_id = i.id and p.fornecedor_id = v_forn.id
    where i.fornecedor_escolhido_id = v_forn.id
    order by i.ordem;

    v_qtd := v_qtd + 1;
  end loop;

  if v_qtd = 0 then
    raise exception 'Escolha um fornecedor para ao menos um produto';
  end if;

  update public.cotacoes set status = 'finalizada', finalizada_em = now(), atualizado_em = now() where id = p_cotacao_id;
  return v_qtd;
end;
$$;

revoke all on function public.gerar_pedidos_cotacao(uuid, date) from public, anon;
grant execute on function public.gerar_pedidos_cotacao(uuid, date) to authenticated;
