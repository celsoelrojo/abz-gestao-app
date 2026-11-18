-- 0054_tipo_produto_consumivel.sql
-- Novo tipo de produto "Consumível" (descartáveis e itens de consumo do dia a
-- dia: guardanapo, canudo, copo descartável...). Fica sozinho neste arquivo
-- porque um valor novo de enum só pode ser usado depois que a transação que o
-- criou termina.
alter type public.estoque_tipo_produto add value if not exists 'Consumível';
