-- 0025_estoque_condicao_armazenamento_enum.sql
-- Pedido do usuário: "Condição de armazenamento" deixa de ser texto livre e
-- vira seleção obrigatória entre Ambiente/Refrigerado/Congelado. Seguro
-- converter a coluna direto pro enum porque ela só existe desde a migration
-- 0024 (deste mesmo recurso) e nenhuma linha real chegou a usá-la ainda —
-- todas estão null, então o cast abaixo nunca falha por valor divergente.
create type public.estoque_condicao_armazenamento as enum ('Ambiente', 'Refrigerado', 'Congelado');

alter table public.estoque_itens
  alter column condicao_armazenamento type public.estoque_condicao_armazenamento
  using condicao_armazenamento::public.estoque_condicao_armazenamento;
