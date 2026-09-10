-- 0040_pedidos_compra.sql
-- Submódulos "Pedidos de Compra" (Administrador cria) e "Receber Mercadoria"
-- (Administrador + Gestor + Bar/Cozinha/Salão conferem) em Estoque e Compras.
-- Pedido do usuário: um pedido é da empresa inteira — pode ter itens de
-- qualquer setor, não é por setor. Freelancer nunca vê.

-- Distingue no histórico do estoque a entrada gerada por recebimento.
alter table public.estoque_movimentos
  drop constraint if exists estoque_movimentos_tipo_check,
  add constraint estoque_movimentos_tipo_check check (
    tipo in (
      'Entrada Manual', 'Entrada por Produção', 'Saída de Estoque',
      'Estorno de Retirada', 'Ajuste de Estoque', 'Entrada por Recebimento'
    )
  );

create table public.pedidos_compra (
  id uuid primary key default gen_random_uuid(),
  fornecedor text not null,
  data_entrega date not null,
  hora_entrega time,
  espelho_url text,                                -- caminho no bucket pedidos-espelhos
  observacoes text,
  status text not null default 'aberto' check (status in ('aberto', 'recebido')),
  criado_por uuid references public.profiles(id),
  criado_em timestamptz not null default now(),
  recebido_por uuid references public.profiles(id),
  recebido_em timestamptz
);

comment on table public.pedidos_compra is 'Pedido de compra da empresa (itens de qualquer setor). Administrador cria; qualquer perfil não-freelancer confere o recebimento.';

create table public.pedidos_compra_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos_compra(id) on delete cascade,
  estoque_item_id uuid references public.estoque_itens(id) on delete set null,
  -- snapshot no momento do pedido (sobrevive à exclusão do produto)
  produto text not null,
  categoria public.estoque_categoria not null,
  unidade public.estoque_unidade not null,
  quantidade numeric(12, 3) not null,             -- quantidade PEDIDA
  ordem int not null default 0,
  -- preenchido na conferência (Receber Mercadoria):
  recebido boolean not null default false,
  quantidade_recebida numeric(12, 3),            -- null = ainda não conferido
  observacao text,
  created_at timestamptz not null default now()
);

alter table public.pedidos_compra enable row level security;
alter table public.pedidos_compra_itens enable row level security;

-- Ver: qualquer perfil logado que não seja freelancer.
create policy "pedidos_compra_select"
  on public.pedidos_compra for select
  using (public.current_role_name() <> 'freelancer');

-- Criar/editar/excluir o pedido: só Administrador.
create policy "pedidos_compra_admin_insert"
  on public.pedidos_compra for insert with check (public.is_admin());
create policy "pedidos_compra_admin_update"
  on public.pedidos_compra for update using (public.is_admin()) with check (public.is_admin());
create policy "pedidos_compra_admin_delete"
  on public.pedidos_compra for delete using (public.is_admin());

create policy "pedidos_compra_itens_select"
  on public.pedidos_compra_itens for select
  using (public.current_role_name() <> 'freelancer');

create policy "pedidos_compra_itens_admin_insert"
  on public.pedidos_compra_itens for insert with check (public.is_admin());

-- Conferência: qualquer não-freelancer marca recebido/quantidade/observação,
-- mas só enquanto o pedido está aberto.
create policy "pedidos_compra_itens_conferir_update"
  on public.pedidos_compra_itens for update
  using (
    public.current_role_name() <> 'freelancer'
    and exists (select 1 from public.pedidos_compra p where p.id = pedido_id and p.status = 'aberto')
  )
  with check (public.current_role_name() <> 'freelancer');

create policy "pedidos_compra_itens_admin_delete"
  on public.pedidos_compra_itens for delete using (public.is_admin());

alter publication supabase_realtime add table public.pedidos_compra;
alter publication supabase_realtime add table public.pedidos_compra_itens;

-- ------------------------------------------------------------
-- Finalizar recebimento — cada item marcado como recebido entra no estoque
-- (quantidade_recebida, ou a pedida se não informada) como 'Entrada por
-- Recebimento'; o pedido fica 'recebido' e sai da fila de Receber Mercadoria.
-- SECURITY DEFINER porque estoque_itens/estoque_movimentos só mudam por função.
-- ------------------------------------------------------------
create or replace function public.finalizar_recebimento(p_pedido_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_pedido public.pedidos_compra;
  v_nome text;
  v_it record;
  v_qtd numeric;
begin
  if public.current_role_name() = 'freelancer' or public.current_role_name() is null then
    raise exception 'Sem permissão para receber mercadoria';
  end if;

  select * into v_pedido from public.pedidos_compra where id = p_pedido_id for update;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if v_pedido.status <> 'aberto' then raise exception 'Este pedido já foi recebido'; end if;

  select coalesce(nome, '') into v_nome from public.profiles where id = auth.uid();

  for v_it in select * from public.pedidos_compra_itens where pedido_id = p_pedido_id loop
    if not v_it.recebido then continue; end if;
    v_qtd := coalesce(v_it.quantidade_recebida, v_it.quantidade);
    if v_qtd is null or v_qtd <= 0 or v_it.estoque_item_id is null then continue; end if;

    update public.estoque_itens set quantidade = quantidade + v_qtd where id = v_it.estoque_item_id;

    insert into public.estoque_movimentos (
      item_id, tipo, categoria, produto, quantidade, unidade, data_hora,
      responsavel_id, responsavel_nome, observacao
    ) values (
      v_it.estoque_item_id, 'Entrada por Recebimento', v_it.categoria, v_it.produto, v_qtd, v_it.unidade, now(),
      auth.uid(), v_nome,
      'Recebimento — ' || v_pedido.fornecedor || ' — pedido de ' || to_char(v_pedido.data_entrega, 'DD/MM/YYYY')
        || coalesce(' · ' || nullif(trim(v_it.observacao), ''), '')
    );
  end loop;

  update public.pedidos_compra
    set status = 'recebido', recebido_por = auth.uid(), recebido_em = now()
    where id = p_pedido_id;
end;
$$;

grant execute on function public.finalizar_recebimento(uuid) to authenticated;

-- ------------------------------------------------------------
-- Bucket do "espelho" (imagem anexada ao pedido) — privado; Administrador
-- escreve, qualquer não-freelancer lê (precisa ver na conferência).
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('pedidos-espelhos', 'pedidos-espelhos', false)
on conflict (id) do nothing;

create policy "pedidos_espelhos_select"
  on storage.objects for select
  using (bucket_id = 'pedidos-espelhos' and public.current_role_name() <> 'freelancer');
create policy "pedidos_espelhos_insert"
  on storage.objects for insert
  with check (bucket_id = 'pedidos-espelhos' and public.is_admin());
create policy "pedidos_espelhos_delete"
  on storage.objects for delete
  using (bucket_id = 'pedidos-espelhos' and public.is_admin());
