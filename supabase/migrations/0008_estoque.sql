-- 0008_estoque.sql
-- Estoque e Compras: itens (saldo atual) + movimentos (entradas/saídas/
-- estornos). Entradas/saídas passam por funções RPC (SECURITY DEFINER) que
-- fazem "select ... for update" antes de mexer na quantidade — isso evita a
-- condição de corrida de dois usuários lançando movimento no mesmo item ao
-- mesmo tempo (requisito explícito do pedido), o que um simples
-- read-then-write no cliente não garante.

create type public.estoque_categoria as enum ('Bar', 'Cozinha', 'Salão', 'Material de Limpeza', 'Outros');
create type public.estoque_unidade as enum ('Caixa', 'Unidade', 'Quilo', 'Litro', 'Grama', 'Mililitro', 'Pacote', 'Fardo');
create type public.motivo_retirada as enum ('Produção', 'Uso interno', 'Perda', 'Vencimento', 'Quebra', 'Transferência', 'Outro');

create table public.estoque_itens (
  id uuid primary key default gen_random_uuid(),
  categoria public.estoque_categoria not null,  -- "Setor" no vocabulário da tela Adicionar Produto
  title text not null,
  quantidade numeric(12, 3) not null default 0,
  unidade public.estoque_unidade not null,
  produto_categoria text,   -- ex.: "Bebidas", "Carnes" — sub-classificação livre (taxonomias.modulo='estoque')
  subcategoria text,
  min numeric(12, 3),
  medio numeric(12, 3),
  max numeric(12, 3),
  validade date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (categoria, title)
);

create trigger estoque_itens_set_updated_at
  before update on public.estoque_itens
  for each row execute function public.set_updated_at();

create table public.estoque_movimentos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.estoque_itens(id),
  tipo text not null check (tipo in ('Entrada Manual', 'Entrada por Produção', 'Saída de Estoque', 'Estorno de Retirada')),
  categoria public.estoque_categoria not null,
  produto text not null,
  produto_categoria text,
  quantidade numeric(12, 3) not null,
  unidade public.estoque_unidade not null,
  data_hora timestamptz not null default now(),
  numero_lote text,
  validade date,
  motivo public.motivo_retirada,
  responsavel_id uuid references public.profiles(id),
  responsavel_nome text not null,
  observacao text,
  tarefa_origem_id bigint references public.checklist_tasks(id),
  lote_id uuid references public.fichas_producao_lotes(id),
  estornada boolean not null default false,
  estorno_de_id uuid references public.estoque_movimentos(id),
  created_at timestamptz not null default now()
);

alter table public.checklist_conclusoes
  add constraint conclusoes_movimento_fk foreign key (movimento_estoque_id) references public.estoque_movimentos(id);

alter table public.estoque_itens enable row level security;
alter table public.estoque_movimentos enable row level security;

create policy "estoque_itens_select"
  on public.estoque_itens for select
  using (public.is_admin() or categoria::text = public.user_setor()::text);

-- "+ Adicionar Produto": Administrador em qualquer categoria; qualquer outro
-- perfil só na própria (Material de Limpeza/Outros nunca batem com
-- user_setor(), então continuam exclusivas do Administrador).
create policy "estoque_itens_insert"
  on public.estoque_itens for insert
  with check (public.is_admin() or categoria::text = public.user_setor()::text);

-- Update direto é só pra Estoque Mínimo/Máximo (min/medio/max) — a
-- quantidade em si só muda pelas funções abaixo.
create policy "estoque_itens_update"
  on public.estoque_itens for update
  using (public.is_admin() or (public.is_setor_manager() and categoria::text = public.user_setor()::text))
  with check (public.is_admin() or (public.is_setor_manager() and categoria::text = public.user_setor()::text));

create policy "estoque_movimentos_select"
  on public.estoque_movimentos for select
  using (public.is_admin() or categoria::text = public.user_setor()::text);
-- Sem policy de insert pro client: só as funções abaixo escrevem aqui
-- (SECURITY DEFINER ignora RLS, e cada uma valida permissão por dentro).

alter publication supabase_realtime add table public.estoque_itens;
alter publication supabase_realtime add table public.estoque_movimentos;

-- ------------------------------------------------------------
-- Entrada (Manual ou por Produção) — soma na quantidade, sob lock de linha.
-- ------------------------------------------------------------
create or replace function public.registrar_entrada_estoque(
  p_item_id uuid, p_quantidade numeric, p_tipo text, p_data_hora timestamptz,
  p_numero_lote text default null, p_validade date default null,
  p_observacao text default null, p_tarefa_origem_id bigint default null, p_lote_id uuid default null
) returns public.estoque_movimentos
language plpgsql security definer set search_path = public as $$
declare
  v_item public.estoque_itens;
  v_mov public.estoque_movimentos;
begin
  select * into v_item from public.estoque_itens where id = p_item_id for update;
  if not found then raise exception 'Item de estoque não encontrado'; end if;
  if not (public.is_admin() or v_item.categoria::text = public.user_setor()::text) then
    raise exception 'Sem permissão para lançar entrada nesta categoria';
  end if;

  update public.estoque_itens
    set quantidade = quantidade + p_quantidade, validade = coalesce(p_validade, validade)
    where id = p_item_id;

  insert into public.estoque_movimentos (
    item_id, tipo, categoria, produto, produto_categoria, quantidade, unidade,
    data_hora, numero_lote, validade, responsavel_id, responsavel_nome, observacao, tarefa_origem_id, lote_id
  ) values (
    p_item_id, p_tipo, v_item.categoria, v_item.title, v_item.produto_categoria, p_quantidade, v_item.unidade,
    p_data_hora, p_numero_lote, p_validade, auth.uid(), (select nome from public.profiles where id = auth.uid()),
    p_observacao, p_tarefa_origem_id, p_lote_id
  ) returning * into v_mov;

  return v_mov;
end;
$$;

-- ------------------------------------------------------------
-- Retirada — valida saldo disponível e permissão de setor antes de debitar.
-- ------------------------------------------------------------
create or replace function public.registrar_saida_estoque(
  p_item_id uuid, p_quantidade numeric, p_motivo public.motivo_retirada,
  p_data_hora timestamptz, p_observacao text default null
) returns public.estoque_movimentos
language plpgsql security definer set search_path = public as $$
declare
  v_item public.estoque_itens;
  v_mov public.estoque_movimentos;
begin
  select * into v_item from public.estoque_itens where id = p_item_id for update;
  if not found then raise exception 'Item de estoque não encontrado'; end if;
  if not (public.is_admin() or (public.is_setor_manager() and v_item.categoria::text = public.user_setor()::text)) then
    raise exception 'Sem permissão para retirar deste setor';
  end if;
  if p_quantidade > v_item.quantidade then
    raise exception 'Quantidade retirada maior que o saldo disponível';
  end if;

  update public.estoque_itens set quantidade = quantidade - p_quantidade where id = p_item_id;

  insert into public.estoque_movimentos (
    item_id, tipo, categoria, produto, produto_categoria, quantidade, unidade,
    data_hora, motivo, responsavel_id, responsavel_nome, observacao
  ) values (
    p_item_id, 'Saída de Estoque', v_item.categoria, v_item.title, v_item.produto_categoria, p_quantidade, v_item.unidade,
    p_data_hora, p_motivo, auth.uid(), (select nome from public.profiles where id = auth.uid()), p_observacao
  ) returning * into v_mov;

  return v_mov;
end;
$$;

-- ------------------------------------------------------------
-- Estorno — exclusivo Administrador; nunca apaga a retirada original, só
-- marca estornada=true e cria um novo movimento de correção.
-- ------------------------------------------------------------
create or replace function public.estornar_retirada_estoque(p_movimento_id uuid)
returns public.estoque_movimentos
language plpgsql security definer set search_path = public as $$
declare
  v_original public.estoque_movimentos;
  v_estorno public.estoque_movimentos;
begin
  if not public.is_admin() then raise exception 'Só o Administrador pode estornar'; end if;

  select * into v_original from public.estoque_movimentos where id = p_movimento_id and tipo = 'Saída de Estoque' for update;
  if not found then raise exception 'Retirada não encontrada'; end if;
  if v_original.estornada then raise exception 'Retirada já estornada'; end if;

  update public.estoque_itens set quantidade = quantidade + v_original.quantidade where id = v_original.item_id;
  update public.estoque_movimentos set estornada = true where id = p_movimento_id;

  insert into public.estoque_movimentos (
    item_id, tipo, categoria, produto, produto_categoria, quantidade, unidade,
    data_hora, motivo, responsavel_id, responsavel_nome, observacao, estorno_de_id
  ) values (
    v_original.item_id, 'Estorno de Retirada', v_original.categoria, v_original.produto, v_original.produto_categoria,
    v_original.quantidade, v_original.unidade, now(), v_original.motivo, auth.uid(),
    (select nome from public.profiles where id = auth.uid()), 'Estorno da retirada #' || v_original.id::text, p_movimento_id
  ) returning * into v_estorno;

  return v_estorno;
end;
$$;
