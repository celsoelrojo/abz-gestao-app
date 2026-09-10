-- 0039_estoque_volume_proprio_embalagem.sql
-- Cadastro/edição de produto (pedido do usuário):
-- - Unidade "Unidade" ganha um "volume próprio" + a unidade de medida desse
--   volume (Litro / Mililitro / Quilo / Grama).
-- - "Caixa" / "Pacote" / "Fardo" ganham, antes do volume próprio, quantas
--   unidades vêm dentro da embalagem.
-- Reaproveita volume_padrao (0024) como o "volume próprio". A unidade do
-- volume usa o enum estoque_unidade que já existe — o app é que limita o
-- dropdown às 4 medidas base.
alter table public.estoque_itens
  add column volume_padrao_unidade public.estoque_unidade,
  add column unidades_por_embalagem numeric(10, 3);

comment on column public.estoque_itens.volume_padrao_unidade is 'Unidade de medida de volume_padrao (Litro/Mililitro/Quilo/Grama). Só faz sentido quando unidade é Unidade/Caixa/Pacote/Fardo.';
comment on column public.estoque_itens.unidades_por_embalagem is 'Quantas unidades vêm dentro de uma Caixa/Pacote/Fardo.';
