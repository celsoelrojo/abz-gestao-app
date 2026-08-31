-- 0032_producao_checklist_ingredientes.sql
-- Concluir uma tarefa "envolve produção" passa a: 1) usar o Rendimento
-- declarado na ficha (não mais uma unidade escolhida à mão e desconectada
-- da ficha), 2) baixar do Estoque os ingredientes realmente usados (antes
-- só dava entrada no produto final, nunca baixava os ingredientes — pedido
-- do usuário), 3) achar o produto remanufaturado pelo vínculo cadastro-first
-- (estoque_itens.ficha_producao_id, migration 0024) em vez do find-or-create
-- por nome que a versão original (0019) fazia — essa última era da época
-- anterior ao cadastro-first e não faz mais sentido.
drop function if exists public.registrar_producao_checklist(uuid, numeric, public.estoque_unidade);

create or replace function public.registrar_producao_checklist(
  p_producao_id uuid, p_quantidade numeric, p_ingredientes jsonb default '[]'::jsonb
)
returns table(lote_id uuid, movimento_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_producao public.fichas_producao;
  v_prefixo text;
  v_seq int;
  v_numero_lote text;
  v_agora timestamptz := now();
  v_validade timestamptz;
  v_item_id uuid;
  v_item_unidade public.estoque_unidade;
  v_lote_id uuid;
  v_mov_id uuid;
  v_nome text;
  v_ing jsonb;
  v_ing_item public.estoque_itens;
  v_ing_qtd numeric;
begin
  select * into v_producao from public.fichas_producao where id = p_producao_id;
  if not found then raise exception 'Ficha de produção não encontrada'; end if;
  if not (public.is_admin() or v_producao.setor = public.user_setor()::text) then
    raise exception 'Sem permissão para registrar produção neste setor';
  end if;

  select coalesce(nome, '') into v_nome from public.profiles where id = auth.uid();

  select count(*) + 1 into v_seq from public.fichas_producao_lotes where ficha_id = p_producao_id;
  v_prefixo := upper(regexp_replace(coalesce(nullif(v_producao.codigo, ''), substring(v_producao.nome, 1, 3)), '[^A-Za-z0-9]', '', 'g'));
  if v_prefixo = '' then v_prefixo := 'LOTE'; end if;
  v_numero_lote := v_prefixo || '-' || to_char(v_agora, 'DDMM') || '-' || lpad(v_seq::text, 3, '0');

  if v_producao.prazo_validade is not null and v_producao.unidade_validade is not null then
    v_validade := case v_producao.unidade_validade
      when 'Horas' then v_agora + (v_producao.prazo_validade || ' hours')::interval
      when 'Dias' then v_agora + (v_producao.prazo_validade || ' days')::interval
      when 'Semanas' then v_agora + (v_producao.prazo_validade * 7 || ' days')::interval
      when 'Meses' then v_agora + (v_producao.prazo_validade || ' months')::interval
      else null
    end;
  end if;

  insert into public.fichas_producao_lotes (
    ficha_id, numero_lote, data_hora_producao, responsavel, quantidade_produzida, data_hora_validade, observacao
  ) values (
    p_producao_id, v_numero_lote, v_agora, v_nome,
    p_quantidade::text || ' ' || coalesce(v_producao.unidade_rendimento, ''), v_validade,
    'Registrado automaticamente ao concluir a tarefa do Checklist.'
  ) returning id into v_lote_id;

  -- Produto remanufaturado: precisa já estar cadastrado (Estoque > Cadastrar
  -- Produto > Remanufaturado > "Ficha de preparo vinculada") — cadastro-first,
  -- sem find-or-create por nome.
  select id, unidade into v_item_id, v_item_unidade from public.estoque_itens
    where ficha_producao_id = p_producao_id and categoria = v_producao.setor::public.estoque_categoria
    limit 1;
  if v_item_id is null then
    raise exception 'Nenhum produto de Estoque está vinculado a esta ficha de produção. Cadastre o produto remanufaturado (Estoque > Cadastrar Produto) antes de concluir esta tarefa.';
  end if;

  update public.estoque_itens
    set quantidade = quantidade + p_quantidade, validade = coalesce(v_validade::date, validade)
    where id = v_item_id;

  insert into public.estoque_movimentos (
    item_id, tipo, categoria, produto, quantidade, unidade, data_hora, numero_lote, validade,
    responsavel_id, responsavel_nome, lote_id
  ) values (
    v_item_id, 'Entrada por Produção', v_producao.setor::public.estoque_categoria, v_producao.nome, p_quantidade, v_item_unidade,
    v_agora, v_numero_lote, v_validade::date, auth.uid(), v_nome, v_lote_id
  ) returning id into v_mov_id;

  -- Baixa dos ingredientes usados — o client já manda a quantidade final
  -- (sugerida pela mesma escala da Calculadora de Produção, ajustável pelo
  -- operador antes de confirmar). Cada baixa é uma Saída de Estoque comum
  -- (motivo 'Produção'), presa ao mesmo lote_id do lote gerado acima — é por
  -- esse lote_id que reverter_producao_checklist encontra tudo de uma vez
  -- se a tarefa for desmarcada.
  for v_ing in select * from jsonb_array_elements(coalesce(p_ingredientes, '[]'::jsonb))
  loop
    v_ing_qtd := (v_ing->>'quantidade')::numeric;
    if v_ing_qtd is null or v_ing_qtd <= 0 then continue; end if;

    select * into v_ing_item from public.estoque_itens where id = (v_ing->>'estoqueItemId')::uuid for update;
    if not found then
      raise exception 'Ingrediente não encontrado no estoque (id %)', v_ing->>'estoqueItemId';
    end if;
    if v_ing_qtd > v_ing_item.quantidade then
      raise exception 'Saldo insuficiente de "%" para baixar % % (saldo atual: %)',
        v_ing_item.title, v_ing_qtd, v_ing_item.unidade, v_ing_item.quantidade;
    end if;

    update public.estoque_itens set quantidade = quantidade - v_ing_qtd where id = v_ing_item.id;

    insert into public.estoque_movimentos (
      item_id, tipo, categoria, produto, produto_categoria, quantidade, unidade, data_hora,
      motivo, responsavel_id, responsavel_nome, lote_id, observacao
    ) values (
      v_ing_item.id, 'Saída de Estoque', v_ing_item.categoria, v_ing_item.title, v_ing_item.produto_categoria,
      v_ing_qtd, v_ing_item.unidade, v_agora, 'Produção', auth.uid(), v_nome, v_lote_id,
      'Baixa automática — produção de "' || v_producao.nome || '" (lote ' || v_numero_lote || ')'
    );
  end loop;

  return query select v_lote_id, v_mov_id;
end;
$$;

grant execute on function public.registrar_producao_checklist(uuid, numeric, jsonb) to authenticated;

-- ------------------------------------------------------------
-- Reverte um registro de produção (desmarcar a tarefa no mesmo dia) — agora
-- desfaz TODOS os movimentos presos ao lote (entrada do remanufaturado +
-- cada baixa de ingrediente), não só a entrada — por isso o parâmetro
-- p_movimento_id saiu: lote_id sozinho já basta pra achar tudo.
-- ------------------------------------------------------------
drop function if exists public.reverter_producao_checklist(uuid, uuid);

create or replace function public.reverter_producao_checklist(p_lote_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_mov record;
  v_setor text;
begin
  if p_lote_id is null then return; end if;

  select categoria::text into v_setor from public.estoque_movimentos
    where lote_id = p_lote_id and tipo = 'Entrada por Produção' limit 1;
  if v_setor is not null and not (public.is_admin() or v_setor = public.user_setor()::text) then
    raise exception 'Sem permissão para reverter esta produção';
  end if;

  for v_mov in select * from public.estoque_movimentos where lote_id = p_lote_id for update
  loop
    if v_mov.item_id is not null then
      if v_mov.tipo = 'Entrada por Produção' then
        update public.estoque_itens set quantidade = greatest(0, quantidade - v_mov.quantidade) where id = v_mov.item_id;
      elsif v_mov.tipo = 'Saída de Estoque' then
        update public.estoque_itens set quantidade = quantidade + v_mov.quantidade where id = v_mov.item_id;
      end if;
    end if;
  end loop;

  delete from public.estoque_movimentos where lote_id = p_lote_id;
  delete from public.fichas_producao_lotes where id = p_lote_id;
end;
$$;

grant execute on function public.reverter_producao_checklist(uuid) to authenticated;
