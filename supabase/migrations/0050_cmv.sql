-- 0050_cmv.sql
-- Pedido do usuário: Financeiro, etapa 2 = CMV (custo da mercadoria vendida).
-- Exclusivo do Administrador, como o resto do Financeiro.
--
--   CMV = estoque inicial + compras − estoque final
--   CMV % = CMV ÷ faturamento
--
-- Peças:
--   * estoque_custos     custo por unidade de estoque de cada produto (em tabela
--                        à parte, só Administrador: estoque_itens é legível pelos
--                        setores e o custo não pode vazar pra equipe)
--   * faturamento_diario faturamento digitado dia a dia
--   * contas_pagar.data_compra  data da compra (competência) — o vencimento do
--                        boleto não diz em que mês a mercadoria foi comprada
--   * estoque_saldos_em  saldo de cada produto numa data passada, reconstruído
--                        pelo histórico de movimentos (sem "fechamento" manual)
--   * registrar_nota_compra atualizada: grava a data da compra e atualiza o custo
--                        do produto a partir do preço da nota

-- ------------------------------------------------------------
-- Custo unitário por produto do estoque (R$ por unidade do estoque).
-- Tem `id` próprio porque o gatilho de auditoria lê new.id.
-- ------------------------------------------------------------
create table public.estoque_custos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null unique references public.estoque_itens(id) on delete cascade,
  custo_unitario numeric(14, 4) not null check (custo_unitario >= 0),
  origem text not null default 'manual' check (origem in ('manual', 'nota')),
  updated_at timestamptz not null default now()
);

create trigger estoque_custos_set_updated_at
  before update on public.estoque_custos
  for each row execute function public.set_updated_at();

alter table public.estoque_custos enable row level security;

create policy "estoque_custos_admin_all"
  on public.estoque_custos for all
  using (public.is_admin())
  with check (public.is_admin());

create trigger audit_estoque_custos after insert or update or delete on public.estoque_custos
  for each row execute function public.audit_trigger_fn();

-- ------------------------------------------------------------
-- Faturamento do dia (um valor por dia operacional).
-- ------------------------------------------------------------
create table public.faturamento_diario (
  id uuid primary key default gen_random_uuid(),
  data date not null unique,
  valor numeric(12, 2) not null check (valor >= 0),
  observacoes text,
  atualizado_por uuid references public.profiles(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);

create trigger faturamento_diario_set_updated_at
  before update on public.faturamento_diario
  for each row execute function public.set_updated_at();

alter table public.faturamento_diario enable row level security;

create policy "faturamento_diario_admin_all"
  on public.faturamento_diario for all
  using (public.is_admin())
  with check (public.is_admin());

create trigger audit_faturamento_diario after insert or update or delete on public.faturamento_diario
  for each row execute function public.audit_trigger_fn();

-- ------------------------------------------------------------
-- Data da compra: quando vazia, o CMV usa o vencimento (contas lançadas à mão).
-- Notas lidas gravam a data de emissão.
-- ------------------------------------------------------------
alter table public.contas_pagar add column data_compra date;
create index contas_pagar_compra_idx on public.contas_pagar (coalesce(data_compra, vencimento));

-- ------------------------------------------------------------
-- Saldo de cada produto em um momento do passado:
--   saldo(t) = saldo atual − efeito de todos os movimentos depois de t
-- Efeito de cada movimento no saldo (ver 0008/0033): Saída de Estoque tira;
-- Entrada Manual / Produção / Recebimento e Estorno de Retirada somam; Ajuste
-- de Estoque já vem com sinal. Retirada estornada soma −q (saída) e +q
-- (estorno), então o efeito líquido é zero.
-- Produto excluído perde o vínculo (item_id nulo) e fica de fora.
-- ------------------------------------------------------------
create or replace function public.estoque_saldos_em(p_momento timestamptz)
returns table (item_id uuid, quantidade numeric)
language sql stable security definer set search_path = public as $$
  select
    i.id,
    i.quantidade - coalesce(
      sum(case m.tipo when 'Saída de Estoque' then -m.quantidade else m.quantidade end)
        filter (where m.data_hora > p_momento),
      0
    )
  from public.estoque_itens i
  left join public.estoque_movimentos m on m.item_id = i.id
  where public.is_admin()
  group by i.id, i.quantidade
$$;

revoke all on function public.estoque_saldos_em(timestamptz) from public, anon;
grant execute on function public.estoque_saldos_em(timestamptz) to authenticated;

-- ------------------------------------------------------------
-- Fator de conversão do vínculo nota → estoque: quantas unidades do ESTOQUE
-- entram por 1 unidade da NOTA (ex.: 1 CX na nota = 12 UN no estoque → 12).
-- Aprendido junto com o vínculo e usado pra sugerir a quantidade na próxima nota.
-- ------------------------------------------------------------
alter table public.nota_mapeamentos
  add column fator numeric(14,4) not null default 1 check (fator > 0);

-- ------------------------------------------------------------
-- registrar_nota_compra (0049) + data da compra + custo do produto + fator.
--   p_conta : ganha `data_compra`
--   p_itens : cada item ganha `valor_total` (R$ da linha da nota) e `fator`
-- Custo unitário = valor da linha ÷ quantidade lançada no estoque (já na
-- unidade do estoque), só quando há entrada de estoque.
-- ------------------------------------------------------------
create or replace function public.registrar_nota_compra(
  p_conta jsonb, p_itens jsonb, p_fornecedor_chave text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_item jsonb;
  v_obs text;
  v_qtd numeric;
  v_total numeric;
begin
  if not public.is_admin() then
    raise exception 'Apenas o Administrador pode lançar notas';
  end if;

  insert into public.contas_pagar (
    descricao, fornecedor, categoria, valor, vencimento, observacoes,
    numero_nota, chave_acesso, fornecedor_cnpj, nota_foto_path, itens_nota,
    pago_em, valor_pago, forma_pagamento, data_compra
  ) values (
    p_conta->>'descricao', nullif(p_conta->>'fornecedor', ''), coalesce(nullif(p_conta->>'categoria', ''), 'Outros'),
    (p_conta->>'valor')::numeric, (p_conta->>'vencimento')::date, nullif(p_conta->>'observacoes', ''),
    nullif(p_conta->>'numero_nota', ''), nullif(p_conta->>'chave_acesso', ''), nullif(p_conta->>'fornecedor_cnpj', ''),
    nullif(p_conta->>'nota_foto_path', ''), p_conta->'itens_nota',
    nullif(p_conta->>'pago_em', '')::date, nullif(p_conta->>'valor_pago', '')::numeric, nullif(p_conta->>'forma_pagamento', ''),
    nullif(p_conta->>'data_compra', '')::date
  ) returning id into v_id;

  v_obs := 'Nota fiscal' || coalesce(' nº ' || nullif(p_conta->>'numero_nota', ''), '')
           || coalesce(' – ' || nullif(p_conta->>'fornecedor', ''), '');

  for v_item in select * from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) loop
    v_qtd := (v_item->>'quantidade')::numeric;
    v_total := coalesce(nullif(v_item->>'valor_total', '')::numeric, 0);

    if coalesce((v_item->>'dar_entrada')::boolean, false) and v_qtd > 0 then
      perform public.registrar_entrada_estoque(
        (v_item->>'estoque_item_id')::uuid, v_qtd,
        'Entrada por Recebimento', now(), null, null, v_obs, null, null
      );
      if v_total > 0 then
        insert into public.estoque_custos (item_id, custo_unitario, origem)
        values ((v_item->>'estoque_item_id')::uuid, round(v_total / v_qtd, 4), 'nota')
        on conflict (item_id)
          do update set custo_unitario = excluded.custo_unitario, origem = 'nota', updated_at = now();
      end if;
    end if;
    if nullif(p_fornecedor_chave, '') is not null and nullif(v_item->>'descricao_norm', '') is not null then
      insert into public.nota_mapeamentos (fornecedor_chave, descricao_norm, estoque_item_id, fator)
      values (
        p_fornecedor_chave, v_item->>'descricao_norm', (v_item->>'estoque_item_id')::uuid,
        coalesce(nullif(v_item->>'fator', '')::numeric, 1)
      )
      on conflict (fornecedor_chave, descricao_norm)
        do update set estoque_item_id = excluded.estoque_item_id, fator = excluded.fator, updated_at = now();
    end if;
  end loop;

  return v_id;
end;
$$;
