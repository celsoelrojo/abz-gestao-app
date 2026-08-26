-- 0017_reservas_sem_contato_update.sql
-- Atualiza a view reservas_sem_contato (criada na 0009) pra incluir as
-- colunas novas da 0016 (histórico, motivo/dados de cancelamento, criado_por)
-- — nenhuma delas expõe contato do cliente, só telefone/email/instagram
-- continuam de fora, então o Atendente pode ver o histórico e o motivo de
-- um cancelamento normalmente.
-- CREATE OR REPLACE VIEW não deixa reordenar/inserir colunas no meio da
-- lista existente (só apendar no fim) — como estamos reordenando, precisa
-- dropar e recriar. Nada mais depende desta view ainda.
drop view public.reservas_sem_contato;

create view public.reservas_sem_contato as
  select id, nome_cliente, data, horario, periodo, quantidade_pessoas, mesa, ocasiao,
         observacoes, restricoes, responsavel, status, origem, sinal,
         criado_por, motivo_cancelamento, cancelada_por, cancelada_em, historico,
         created_at, updated_at
  from public.reservas;
