-- 0056: corrige o formato do preço na observação dos itens do pedido gerado (saía com "##").
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
           'Cotado a R$ ' || replace(case when round(p.preco_unitario, 2) = p.preco_unitario then to_char(p.preco_unitario, 'FM999999990.00') else to_char(p.preco_unitario, 'FM999999990.0000') end, '.', ',') || ' por ' || lower(i.unidade::text)
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
