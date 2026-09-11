-- 0043_taxonomias_subcategoria_pai.sql
-- Pedido do usuário: subcategorias vinculadas a uma categoria específica —
-- ao escolher "Bebidas alcoólicas" só devem aparecer as subcategorias dela
-- (Destilada, Amari, Licores), não a lista inteira do setor.
--
-- categoria_pai guarda o VALOR da categoria mãe (mesmo modulo/setor). É texto
-- (não FK) de propósito: casa com estoque_itens.produto_categoria, que também
-- é texto livre, e sobrevive ao rename via delete+insert do 0042. NULL =
-- subcategoria ainda não organizada — continua aparecendo só quando nenhuma
-- categoria está escolhida, pra não sumir nem travar nada.
alter table public.taxonomias add column if not exists categoria_pai text;

-- Duas categorias podem ter subcategoria de mesmo nome (ex.: "Comum" em duas
-- delas), então o pai entra na unique. NULLS NOT DISTINCT (PG15+) impede
-- duplicar uma subcategoria sem pai.
alter table public.taxonomias drop constraint if exists taxonomias_modulo_setor_tipo_valor_key;
alter table public.taxonomias
  add constraint taxonomias_modulo_setor_tipo_valor_pai_key
  unique nulls not distinct (modulo, setor, tipo, valor, categoria_pai);

-- Backfill: liga cada subcategoria de estoque à categoria mais usada pelos
-- produtos que já a utilizam (melhor palpite — o Administrador reorganiza
-- depois em "Gerenciar categorias"). Só mexe nas que ainda estão sem pai.
update public.taxonomias t
set categoria_pai = melhor.cat
from (
  select setor, sub, cat
  from (
    select
      ei.categoria::text as setor,
      ei.subcategoria as sub,
      ei.produto_categoria as cat,
      row_number() over (
        partition by ei.categoria, ei.subcategoria
        order by count(*) desc, ei.produto_categoria
      ) as rn
    from public.estoque_itens ei
    where ei.subcategoria is not null and ei.produto_categoria is not null
    group by ei.categoria, ei.subcategoria, ei.produto_categoria
  ) ranked
  where rn = 1
) melhor
where t.modulo = 'estoque'
  and t.tipo = 'subcategoria'
  and t.categoria_pai is null
  and t.setor = melhor.setor
  and t.valor = melhor.sub;

-- UPDATE em taxonomias: necessário pra (re)atribuir a categoria mãe de uma
-- subcategoria e pra soltar as filhas quando a categoria mãe é excluída.
-- Mesmo alcance do insert (Administrador ou Gestor do próprio setor).
create policy "taxonomias_manager_update"
  on public.taxonomias for update
  using (public.is_admin() or (public.is_setor_manager() and setor = public.user_setor()::text))
  with check (public.is_admin() or (public.is_setor_manager() and setor = public.user_setor()::text));

-- Renomear categoria agora também repontua as subcategorias filhas (o
-- categoria_pai delas segue o novo nome), além dos produtos. Sem isso o
-- rename de uma categoria deixaria as subcategorias órfãs.
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

  if v_tax.modulo = 'estoque' then
    if v_tax.tipo = 'categoria' then
      update public.estoque_itens set produto_categoria = v_novo
        where categoria::text = v_tax.setor and produto_categoria = v_tax.valor;
      -- as subcategorias ligadas a essa categoria acompanham o novo nome
      update public.taxonomias set categoria_pai = v_novo
        where modulo = 'estoque' and setor = v_tax.setor
          and tipo = 'subcategoria' and categoria_pai = v_tax.valor;
    else
      update public.estoque_itens set subcategoria = v_novo
        where categoria::text = v_tax.setor and subcategoria = v_tax.valor;
    end if;
  end if;

  insert into public.taxonomias (modulo, setor, tipo, valor, categoria_pai)
    values (v_tax.modulo, v_tax.setor, v_tax.tipo, v_novo, v_tax.categoria_pai)
    on conflict (modulo, setor, tipo, valor, categoria_pai) do nothing;
  delete from public.taxonomias where id = p_id;
end;
$$;

grant execute on function public.renomear_taxonomia(uuid, text) to authenticated;
