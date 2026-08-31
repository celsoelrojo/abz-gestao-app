-- 0030_estoque_movimentos_item_set_null.sql
-- Bug relatado pelo usuário: "não está excluindo o produto". Causa real: a
-- FK estoque_movimentos_item_id_fkey (sem ON DELETE, e item_id NOT NULL)
-- bloqueava a exclusão de QUALQUER produto que já tivesse uma entrada ou
-- retirada registrada — ou seja, praticamente todo produto em uso de
-- verdade, esvaziando na prática o botão de excluir liberado pro
-- Administrador.
--
-- estoque_movimentos já guarda um SNAPSHOT do produto em texto (produto,
-- categoria, produto_categoria, unidade — todos preenchidos na hora do
-- lançamento, nunca lidos via join com estoque_itens) — então o histórico
-- continua totalmente legível mesmo sem o vínculo. Por isso SET NULL aqui é
-- seguro: o movimento sobrevive à exclusão do produto, só perde a
-- referência ao cadastro (mesmo raciocínio já aplicado a fichas_producao na
-- migration 0028).
alter table public.estoque_movimentos alter column item_id drop not null;

alter table public.estoque_movimentos
  drop constraint estoque_movimentos_item_id_fkey,
  add constraint estoque_movimentos_item_id_fkey
    foreign key (item_id) references public.estoque_itens(id) on delete set null;
