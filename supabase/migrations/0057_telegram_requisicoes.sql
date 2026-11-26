-- 0057_telegram_requisicoes.sql
-- Requisições no Telegram: aviso na hora em que alguém abre uma e, todo dia às
-- 5h (Brasília = 08:00 UTC), a lista das que ainda não foram feitas
-- (pendentes e aprovadas não concluídas). Usa a mesma Edge Function e os
-- mesmos destinos dos avisos do Checklist (0053).

alter table public.notificacao_destinos
  add column avisar_requisicoes boolean not null default true;

create or replace function public.trg_notificar_requisicao()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform public.disparar_telegram(jsonb_build_object('tipo', 'requisicao', 'requisicao_id', new.id));
  exception when others then
    null; -- aviso é secundário: nunca pode impedir a abertura da requisição
  end;
  return new;
end;
$$;

create trigger notificar_requisicao_telegram
  after insert on public.requisicoes
  for each row execute function public.trg_notificar_requisicao();

select cron.schedule(
  'telegram-requisicoes-diarias',
  '0 8 * * *',
  $$select public.disparar_telegram('{"tipo":"requisicoes_abertas"}'::jsonb)$$
);
