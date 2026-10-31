-- 0049_contas_pagar.sql
-- Pedido do usuário: módulo Financeiro, etapa 1 = Contas a pagar. Exclusivo do
-- Administrador (nenhum gestor vê). Etapas seguintes (CMV etc.) entram em
-- migrations próprias.
--
-- Uma linha = uma conta com um vencimento. Contas recorrentes/parceladas são
-- várias linhas ligadas por grupo_id (parcela N de M), geradas pela tela — assim
-- cada mês pode ter seu valor e ser paga/editada separadamente.
create table public.contas_pagar (
  id uuid primary key default gen_random_uuid(),
  descricao text not null check (btrim(descricao) <> ''),
  fornecedor text,
  categoria text not null default 'Outros',
  valor numeric(12, 2) not null check (valor > 0),
  vencimento date not null,
  observacoes text,
  -- Nota fiscal / cupom (preenchidos pela leitura da foto, ver "Ler nota"):
  numero_nota text,
  chave_acesso text check (chave_acesso is null or chave_acesso ~ '^[0-9]{44}$'),
  fornecedor_cnpj text,
  nota_foto_path text,   -- caminho no bucket notas-fiscais
  itens_nota jsonb,      -- [{descricao, quantidade, unidade, valor_unitario, valor_total, estoque_item_id}]
  grupo_id uuid,
  parcela int check (parcela is null or parcela >= 1),
  parcelas int check (parcelas is null or parcelas >= 1),
  -- Pagamento: conta em aberto = pago_em nulo.
  pago_em date,
  valor_pago numeric(12, 2) check (valor_pago is null or valor_pago >= 0),
  forma_pagamento text,
  criado_por uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conta_paga_com_valor check ((pago_em is null) = (valor_pago is null))
);

create index contas_pagar_vencimento_idx on public.contas_pagar (vencimento);
create index contas_pagar_aberta_idx on public.contas_pagar (vencimento) where pago_em is null;
create index contas_pagar_grupo_idx on public.contas_pagar (grupo_id) where grupo_id is not null;

create trigger contas_pagar_set_updated_at
  before update on public.contas_pagar
  for each row execute function public.set_updated_at();

alter table public.contas_pagar enable row level security;

-- Só o Administrador, em tudo. Qualquer outro perfil (e anônimo) não enxerga
-- nem uma linha.
create policy "contas_pagar_admin_all"
  on public.contas_pagar for all
  using (public.is_admin())
  with check (public.is_admin());

create trigger audit_contas_pagar after insert or update or delete on public.contas_pagar
  for each row execute function public.audit_trigger_fn();

alter publication supabase_realtime add table public.contas_pagar;

-- A mesma nota não entra duas vezes: a chave de acesso (44 dígitos, impressa no
-- cupom/DANFE) é única. Sem chave, a tela avisa por CNPJ + número da nota.
create unique index contas_pagar_chave_acesso_uq on public.contas_pagar (chave_acesso) where chave_acesso is not null;
create index contas_pagar_nota_idx on public.contas_pagar (fornecedor_cnpj, numero_nota) where numero_nota is not null;

-- ------------------------------------------------------------
-- Foto da nota (bucket privado, só o Administrador).
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('notas-fiscais', 'notas-fiscais', false)
on conflict (id) do nothing;

create policy "notas_fiscais_admin_all"
  on storage.objects for all
  using (bucket_id = 'notas-fiscais' and public.is_admin())
  with check (bucket_id = 'notas-fiscais' and public.is_admin());

-- ------------------------------------------------------------
-- "Aprendizado" da leitura: como a descrição de um item na nota de um fornecedor
-- corresponde a um produto do Estoque. Na próxima nota do mesmo fornecedor o
-- app já sugere o produto certo. Ambas as chaves vêm normalizadas pela tela
-- (minúsculas, sem acento/pontuação); o banco só guarda.
-- ------------------------------------------------------------
create table public.nota_mapeamentos (
  id uuid primary key default gen_random_uuid(),
  fornecedor_chave text not null,   -- CNPJ (só dígitos) ou, sem CNPJ, o nome normalizado
  descricao_norm text not null,
  estoque_item_id uuid not null references public.estoque_itens(id) on delete cascade,
  updated_at timestamptz not null default now(),
  unique (fornecedor_chave, descricao_norm)
);

alter table public.nota_mapeamentos enable row level security;

create policy "nota_mapeamentos_admin_all"
  on public.nota_mapeamentos for all
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------
-- Lança uma nota inteira numa transação só: cria a conta a pagar, dá entrada no
-- estoque dos itens marcados e grava o aprendizado. Se qualquer passo falhar,
-- nada fica pela metade (conta sem entrada, ou entrada sem conta).
--   p_conta : campos da conta (ver abaixo)
--   p_itens : [{ estoque_item_id, quantidade, dar_entrada, descricao_norm }]
--             (só as linhas em que a pessoa escolheu um produto do estoque)
--   p_fornecedor_chave : chave do aprendizado (CNPJ ou nome normalizado)
-- ------------------------------------------------------------
create or replace function public.registrar_nota_compra(
  p_conta jsonb, p_itens jsonb, p_fornecedor_chave text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_item jsonb;
  v_obs text;
begin
  if not public.is_admin() then
    raise exception 'Apenas o Administrador pode lançar notas';
  end if;

  insert into public.contas_pagar (
    descricao, fornecedor, categoria, valor, vencimento, observacoes,
    numero_nota, chave_acesso, fornecedor_cnpj, nota_foto_path, itens_nota,
    pago_em, valor_pago, forma_pagamento
  ) values (
    p_conta->>'descricao', nullif(p_conta->>'fornecedor', ''), coalesce(nullif(p_conta->>'categoria', ''), 'Outros'),
    (p_conta->>'valor')::numeric, (p_conta->>'vencimento')::date, nullif(p_conta->>'observacoes', ''),
    nullif(p_conta->>'numero_nota', ''), nullif(p_conta->>'chave_acesso', ''), nullif(p_conta->>'fornecedor_cnpj', ''),
    nullif(p_conta->>'nota_foto_path', ''), p_conta->'itens_nota',
    nullif(p_conta->>'pago_em', '')::date, nullif(p_conta->>'valor_pago', '')::numeric, nullif(p_conta->>'forma_pagamento', '')
  ) returning id into v_id;

  v_obs := 'Nota fiscal' || coalesce(' nº ' || nullif(p_conta->>'numero_nota', ''), '')
           || coalesce(' – ' || nullif(p_conta->>'fornecedor', ''), '');

  for v_item in select * from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) loop
    if coalesce((v_item->>'dar_entrada')::boolean, false) and (v_item->>'quantidade')::numeric > 0 then
      perform public.registrar_entrada_estoque(
        (v_item->>'estoque_item_id')::uuid, (v_item->>'quantidade')::numeric,
        'Entrada por Recebimento', now(), null, null, v_obs, null, null
      );
    end if;
    if nullif(p_fornecedor_chave, '') is not null and nullif(v_item->>'descricao_norm', '') is not null then
      insert into public.nota_mapeamentos (fornecedor_chave, descricao_norm, estoque_item_id)
      values (p_fornecedor_chave, v_item->>'descricao_norm', (v_item->>'estoque_item_id')::uuid)
      on conflict (fornecedor_chave, descricao_norm)
        do update set estoque_item_id = excluded.estoque_item_id, updated_at = now();
    end if;
  end loop;

  return v_id;
end;
$$;

revoke all on function public.registrar_nota_compra(jsonb, jsonb, text) from public, anon;
grant execute on function public.registrar_nota_compra(jsonb, jsonb, text) to authenticated;
