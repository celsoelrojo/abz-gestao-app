-- 0018_reservas_hoje_resumo.sql
-- No protótipo, o resumo "Hoje teremos N pessoas reservadas..." aparece pra
-- TODOS os perfis no painel de Mensagens Importantes, inclusive Bar/Cozinha,
-- que não têm acesso nenhum ao módulo Reservas (comentário original: "Cozinha
-- também quer saber o tamanho do movimento do dia"). A RLS de `reservas`
-- restringe a leitura a Administrador/Salão, então precisa de uma função
-- SECURITY DEFINER que devolve só o agregado (total de pessoas por período),
-- nunca as linhas em si — não vaza nome/contato de cliente pra quem não
-- deveria ver reserva nenhuma.
create or replace function public.reservas_hoje_resumo()
returns table(periodo public.reserva_periodo, total_pessoas bigint)
language sql stable security definer set search_path = public as $$
  select periodo, coalesce(sum(quantidade_pessoas), 0) as total_pessoas
  from public.reservas
  where data = current_date and status <> 'cancelada'
  group by periodo;
$$;

grant execute on function public.reservas_hoje_resumo() to authenticated;
