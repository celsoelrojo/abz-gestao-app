-- 0033_estoque_ajuste_quantidade.sql
-- Pedido do usuário: Administrador poder ajustar diretamente a quantidade
-- de um item de Estoque (contagem física, corrigir erro de lançamento, etc.)
-- sem passar por Entrada/Retirada. Segue o mesmo padrão de
-- registrar_entrada_estoque/registrar_saida_estoque: função SECURITY
-- DEFINER com lock de linha, que grava um estoque_movimentos pra manter o
-- histórico auditável (a diferença é registrada com sinal — pode ser
-- negativa, diferente dos outros tipos de movimento que são sempre
-- positivos e têm a direção implícita no `tipo`).
alter table public.estoque_movimentos
  drop constraint if exists estoque_movimentos_tipo_check,
  add constraint estoque_movimentos_tipo_check
    check (tipo in ('Entrada Manual', 'Entrada por Produção', 'Saída de Estoque', 'Estorno de Retirada', 'Ajuste de Estoque'));

create or replace function public.registrar_ajuste_estoque(
  p_item_id uuid, p_nova_quantidade numeric, p_observacao text default null
) returns public.estoque_movimentos
language plpgsql security definer set search_path = public as $$
declare
  v_item public.estoque_itens;
  v_mov public.estoque_movimentos;
  v_diferenca numeric;
begin
  if not public.is_admin() then raise exception 'Só o Administrador pode ajustar a quantidade em estoque'; end if;
  if p_nova_quantidade < 0 then raise exception 'A quantidade não pode ser negativa'; end if;

  select * into v_item from public.estoque_itens where id = p_item_id for update;
  if not found then raise exception 'Item de estoque não encontrado'; end if;

  v_diferenca := p_nova_quantidade - v_item.quantidade;
  if v_diferenca = 0 then raise exception 'A nova quantidade é igual à quantidade atual'; end if;

  update public.estoque_itens set quantidade = p_nova_quantidade where id = p_item_id;

  insert into public.estoque_movimentos (
    item_id, tipo, categoria, produto, produto_categoria, quantidade, unidade,
    data_hora, responsavel_id, responsavel_nome, observacao
  ) values (
    p_item_id, 'Ajuste de Estoque', v_item.categoria, v_item.title, v_item.produto_categoria, v_diferenca, v_item.unidade,
    now(), auth.uid(), (select nome from public.profiles where id = auth.uid()),
    'Ajuste manual: de ' || v_item.quantidade::text || ' para ' || p_nova_quantidade::text || coalesce(' — ' || nullif(trim(p_observacao), ''), '')
  ) returning * into v_mov;

  return v_mov;
end;
$$;

grant execute on function public.registrar_ajuste_estoque(uuid, numeric, text) to authenticated;
