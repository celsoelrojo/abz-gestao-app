-- 0045_cardapio_semanal.sql
-- Pedido do usuário: o cardápio do módulo Cardápio RAF é SEMANAL — um prato
-- por dia, escolhido entre as Fichas Técnicas da Cozinha, sem preço. Isso
-- troca o formato da 0044 (nome + itens com seção/preço) por:
--   semana_inicio: a segunda-feira da semana (uma linha por semana)
--   dias: [{ data, fichaTecnicaId, nome }] — só os dias com prato; "nome" é
--         uma cópia do nome da ficha na hora de salvar, pra o histórico
--         continuar legível se a ficha for renomeada ou apagada.
--
-- A 0044 acabou de ser criada: se já houver linha no formato antigo, aborta
-- em vez de apagar — quem tiver dado ali decide o que fazer com ele.
do $$
begin
  if exists (select 1 from public.cardapios) then
    raise exception 'cardapios ainda tem linhas no formato antigo (0044); revise antes de migrar para o cardápio semanal';
  end if;
end $$;

alter table public.cardapios
  drop column nome,
  drop column itens;

alter table public.cardapios
  add column semana_inicio date not null unique
    check (extract(isodow from semana_inicio) = 1),
  add column dias jsonb not null default '[]'
    check (jsonb_typeof(dias) = 'array');
