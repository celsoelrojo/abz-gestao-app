-- 0027_estoque_itens_insert_manager.sql
-- Pedido do usuário: "Cadastrar Produto" passa a ser só de Administrador/
-- Gestor (a UI já esconde a aba pra quem não é — ver EstoquePage.tsx — mas a
-- policy de insert ainda deixava qualquer perfil do setor criar produto
-- direto pela API). Alinha a policy de insert com a de update, que já era
-- restrita a is_setor_manager().
drop policy "estoque_itens_insert" on public.estoque_itens;

create policy "estoque_itens_insert"
  on public.estoque_itens for insert
  with check (public.is_admin() or (public.is_setor_manager() and categoria::text = public.user_setor()::text));
