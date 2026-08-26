-- 0016_mensagens_reservas_full.sql
-- Fecha os módulos Mensagens Importantes e Reservas: corrige a policy de
-- exclusão de mensagens (era permissiva demais), adiciona a policy de edição
-- que faltava, e completa o schema de reservas (histórico, cancelamento,
-- status com os 7 valores reais do protótipo). Também libera uma leitura
-- bem específica de freelancer_escalas pra Cozinha — só o resumo "hoje" do
-- painel de Mensagens, não o módulo Freelancer inteiro (que continua
-- exclusivo do Administrador).

-- ------------------------------------------------------------
-- Mensagens — só Administrador exclui (o protótipo nunca deixou Gestor de
-- setor apagar, só editar a própria); a policy antiga aqui estava errada.
-- ------------------------------------------------------------
drop policy "mensagens_delete_manager" on public.mensagens;

create policy "mensagens_admin_delete"
  on public.mensagens for delete
  using (public.is_admin());

-- Editar: mesma regra de quem pode publicar (Administrador em qualquer
-- destino; Gestor de setor só nas mensagens do próprio setor, nunca 'Todos').
create policy "mensagens_update_manager"
  on public.mensagens for update
  using (public.is_admin() or (public.is_setor_manager() and destino = public.user_setor()::text))
  with check (public.is_admin() or (public.is_setor_manager() and destino = public.user_setor()::text));

-- ------------------------------------------------------------
-- Reservas — completa os campos que a migration 0009 deixou de fora:
-- histórico de mudanças, dados do cancelamento, e quem criou o registro
-- (diferente de "responsavel", que é o campo editável "responsável pelo
-- registro" — criado_por é fixo, nunca muda depois de criado).
-- ------------------------------------------------------------
alter table public.reservas
  add column criado_por text,
  add column motivo_cancelamento text,
  add column cancelada_por text,
  add column cancelada_em timestamptz,
  add column historico jsonb not null default '[]';

comment on column public.reservas.historico is 'Array de {data, tipo, autor, detalhe} — confirmacao, cancelamento, mudanca_mesa. Nunca reescrito, só recebe itens novos.';

-- status real do protótipo tem 7 valores, não só Confirmada/Cancelada, e o
-- default é 'pendente' (a 0009 tinha 'Confirmada' como default, errado).
alter table public.reservas alter column status drop default;
alter table public.reservas add constraint status_valido check (
  status in ('pendente', 'confirmada', 'cancelada', 'cliente_chegou', 'em_atendimento', 'concluida', 'nao_compareceu')
);
alter table public.reservas alter column status set default 'pendente';

-- ------------------------------------------------------------
-- Resumo "Freelancers hoje" no painel de Mensagens Importantes (só
-- Cozinha/Gestor de Cozinha veem, só do próprio setor) — leitura pontual,
-- não abre o módulo Freelancer (que segue admin-only pra tudo mais).
-- ------------------------------------------------------------
create policy "freelancer_escalas_cozinha_select_hoje"
  on public.freelancer_escalas for select
  using (
    setor = 'Cozinha'
    and (public.current_role_name() in ('gestor_cozinha', 'cozinha'))
  );
