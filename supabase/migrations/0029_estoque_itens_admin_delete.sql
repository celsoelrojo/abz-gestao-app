-- 0029_estoque_itens_admin_delete.sql
-- Pedido do usuário: Administrador poder excluir um produto cadastrado em
-- "Produtos cadastrados". Não existia NENHUMA policy de delete em
-- estoque_itens até agora — mesmo o Administrador não conseguia (RLS nega
-- por padrão sem policy). Só Administrador (não Gestor) — mesmo padrão de
-- "excluir" usado em fichas_tecnicas_admin_delete/fichas_producao_admin_delete.
--
-- Continua bloqueado pelo Postgres (estoque_movimentos_item_id_fkey, sem ON
-- DELETE) excluir um produto que já tem entrada/retirada registrada — de
-- propósito: apagar o cadastro não deve apagar histórico de movimentação.
-- Isso é tratado como erro amigável no client (useEstoque.excluirProdutoEstoque).
create policy "estoque_itens_admin_delete"
  on public.estoque_itens for delete
  using (public.is_admin());
