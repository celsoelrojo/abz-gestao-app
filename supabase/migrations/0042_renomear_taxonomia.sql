-- 0042_renomear_taxonomia.sql
-- Pedido do usuário: além de excluir, poder EDITAR (renomear)
-- categorias/subcategorias. Diferente do excluir (que não toca em produto),
-- renomear repontua: os produtos do setor que tinham o valor antigo passam
-- a ter o novo — senão o rename não serviria pra nada. Se o novo nome já
-- existir como sugestão, vira uma junção (os dois viram um só). Só o
-- Administrador. SECURITY DEFINER pra fazer os dois updates numa transação.
create or replace function public.renomear_taxonomia(p_id uuid, p_novo text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_tax public.taxonomias;
  v_novo text := trim(p_novo);
begin
  if not public.is_admin() then raise exception 'Só o Administrador edita categorias'; end if;
  if v_novo = '' then raise exception 'O nome não pode ficar vazio'; end if;

  select * into v_tax from public.taxonomias where id = p_id;
  if not found then raise exception 'Categoria não encontrada'; end if;
  if v_novo = v_tax.valor then return; end if;

  -- Repontua os produtos do setor (só faz sentido pro módulo estoque; os
  -- outros módulos guardam a categoria noutras tabelas).
  if v_tax.modulo = 'estoque' then
    if v_tax.tipo = 'categoria' then
      update public.estoque_itens set produto_categoria = v_novo
        where categoria::text = v_tax.setor and produto_categoria = v_tax.valor;
    else
      update public.estoque_itens set subcategoria = v_novo
        where categoria::text = v_tax.setor and subcategoria = v_tax.valor;
    end if;
  end if;

  -- Garante a sugestão nova (junta, se já existir) e remove a antiga.
  insert into public.taxonomias (modulo, setor, tipo, valor)
    values (v_tax.modulo, v_tax.setor, v_tax.tipo, v_novo)
    on conflict (modulo, setor, tipo, valor) do nothing;
  delete from public.taxonomias where id = p_id;
end;
$$;

grant execute on function public.renomear_taxonomia(uuid, text) to authenticated;
