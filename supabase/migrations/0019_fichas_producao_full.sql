-- 0019_fichas_producao_full.sql
-- A migration 0007 só cobriu um subconjunto de fichas_producao — a pesquisa
-- no protótipo (makeProducao, script.js:1616-1680) revelou vários campos que
-- ficaram de fora: foto, vínculo reverso com Fichas Técnicas, produção em
-- volume, roteiro operacional complementar, e o histórico de versões (que
-- Fichas de Produção TEM e Fichas Técnicas não tem — assimetria real do
-- protótipo, não descuido).
alter table public.fichas_producao
  add column foto_principal_url text,
  add column fichas_tecnicas_vinculadas jsonb not null default '[]',
  add column criado_em date not null default current_date,
  add column ultima_revisao_em date,
  add column qtd_lote_padrao numeric,
  add column unidade_rendimento text,
  add column qtd_porcoes_unidades numeric,
  add column tempo_pre_preparo text,
  add column tempo_preparo text,
  add column tempo_descanso text,
  add column tempo_resfriamento text,
  add column tempo_total text,
  add column pode_ser_fracionada boolean not null default false,
  add column higienizacao text,
  add column epis text,
  add column cuidados_manipulacao text,
  add column padrao_esperado text,
  add column criterios_aprovacao text,
  add column acoes_corretivas text,
  add column alergenicos text,
  add column observacoes_gerais text,
  add column vinculos jsonb not null default '[]',
  add column historico jsonb not null default '[]';

comment on column public.fichas_producao.historico is 'Array de {data, tipo: criacao|revisao|publicacao, autor} — só Fichas de Produção tem isso, Fichas Técnicas não (confirmado no protótipo).';
comment on column public.fichas_producao.fichas_tecnicas_vinculadas is 'IDs de fichas_tecnicas que consomem esta produção — link reverso, editado no lado da Ficha de Produção.';

-- ------------------------------------------------------------
-- Registrar produção ao concluir uma tarefa do Checklist com
-- envolve_producao=true — cria o lote, dá entrada no Estoque (find-or-create
-- do item pelo nome da ficha) e devolve os ids pra o client anexar na
-- conclusão do Checklist. Espelha finalizarFluxoProducao/registrarMovimentoEstoque
-- do protótipo (gerarNumeroLote incluso: prefixo do código ou 3 letras do
-- nome + DDMM + sequencial de 3 dígitos).
-- ------------------------------------------------------------
create or replace function public.registrar_producao_checklist(
  p_producao_id uuid, p_quantidade numeric, p_unidade public.estoque_unidade
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
  v_lote_id uuid;
  v_mov_id uuid;
  v_nome text;
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
    p_producao_id, v_numero_lote, v_agora, v_nome, p_quantidade::text || ' ' || p_unidade::text, v_validade,
    'Registrado automaticamente ao concluir a tarefa do Checklist.'
  ) returning id into v_lote_id;

  select id into v_item_id from public.estoque_itens
    where categoria = v_producao.setor::public.estoque_categoria and lower(title) = lower(v_producao.nome)
    limit 1;
  if v_item_id is null then
    insert into public.estoque_itens (categoria, title, quantidade, unidade)
    values (v_producao.setor::public.estoque_categoria, v_producao.nome, 0, p_unidade)
    returning id into v_item_id;
  end if;

  update public.estoque_itens
    set quantidade = quantidade + p_quantidade, validade = coalesce(v_validade::date, validade)
    where id = v_item_id;

  insert into public.estoque_movimentos (
    item_id, tipo, categoria, produto, quantidade, unidade, data_hora, numero_lote, validade,
    responsavel_id, responsavel_nome, lote_id
  ) values (
    v_item_id, 'Entrada por Produção', v_producao.setor::public.estoque_categoria, v_producao.nome, p_quantidade, p_unidade,
    v_agora, v_numero_lote, v_validade::date, auth.uid(), v_nome, v_lote_id
  ) returning id into v_mov_id;

  return query select v_lote_id, v_mov_id;
end;
$$;

grant execute on function public.registrar_producao_checklist(uuid, numeric, public.estoque_unidade) to authenticated;

-- ------------------------------------------------------------
-- Reverte um registro de produção (desmarcar a tarefa no mesmo dia) — espelha
-- estornarMovimentoEstoque do protótipo: SUBTRAI (nunca cria um estorno com
-- histórico, diferente da retirada) e REMOVE o movimento e o lote, porque a
-- produção nunca aconteceu de verdade se foi desmarcada na hora.
-- ------------------------------------------------------------
create or replace function public.reverter_producao_checklist(p_lote_id uuid, p_movimento_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_mov public.estoque_movimentos;
begin
  select * into v_mov from public.estoque_movimentos where id = p_movimento_id and tipo = 'Entrada por Produção' for update;
  if not found then return; end if;
  if not (public.is_admin() or v_mov.categoria::text = public.user_setor()::text) then
    raise exception 'Sem permissão para reverter esta produção';
  end if;
  update public.estoque_itens set quantidade = greatest(0, quantidade - v_mov.quantidade) where id = v_mov.item_id;
  delete from public.estoque_movimentos where id = p_movimento_id;
  if p_lote_id is not null then
    delete from public.fichas_producao_lotes where id = p_lote_id;
  end if;
end;
$$;

grant execute on function public.reverter_producao_checklist(uuid, uuid) to authenticated;
