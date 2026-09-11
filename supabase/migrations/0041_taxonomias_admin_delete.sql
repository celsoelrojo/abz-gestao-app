-- 0041_taxonomias_admin_delete.sql
-- Pedido do usuário: poder apagar categorias/subcategorias (as sugestões da
-- tabela taxonomias). Até agora não havia policy de delete nenhuma —
-- ninguém conseguia. Só o Administrador exclui (adicionar continua sendo
-- Administrador OU Gestor do setor, ver taxonomias_manager_insert em 0006).
-- Apagar aqui não toca em produto nenhum: produto_categoria/subcategoria em
-- estoque_itens são texto livre, não FK — o valor some só da lista de
-- sugestões.
create policy "taxonomias_admin_delete"
  on public.taxonomias for delete
  using (public.is_admin());
