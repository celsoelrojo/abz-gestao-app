-- 0020_pops_full.sql
-- Duas correções levantadas pela pesquisa no protótipo (script.js):
--
-- 1) Campos que existem de verdade no formulário/detalhe de POP (editáveis,
--    exibidos) mas ficaram de fora da 0005: alertaImportante,
--    situacoesEspecificas, responsavelMonitoramento, checklistVinculadoId,
--    localRegistro, referencias, vinculos (Mapa/POP, mesmo formato de
--    fichas_tecnicas.vinculos).
--
-- 2) A 0005 restringiu POP's a Administrador-only (`pops_admin_write`), mas
--    o protótipo de verdade deixa o Gestor do setor criar/editar/publicar/
--    reordenar POP's do PRÓPRIO setor (savePop/movePop/publishPop usam
--    isManager(setor), não isFullAdmin) — só exclusão definitiva e a gestão
--    de categorias globais são exclusivas do Administrador. Confirmado com o
--    usuário: replicar o comportamento real do protótipo, consistente com
--    Mapas/Fichas Técnicas/Fichas de Produção. 'Geral' não é um setor de
--    ninguém, então só Administrador cria/edita POP's 'Geral'.

alter table public.pops
  add column alerta_importante text,
  add column situacoes_especificas text,
  add column responsavel_monitoramento text,
  add column checklist_vinculado_id bigint references public.checklist_tasks(id),
  add column local_registro text,
  add column referencias text,
  add column vinculos jsonb not null default '[]';

drop policy "pops_admin_write" on public.pops;

create policy "pops_manager_insert"
  on public.pops for insert
  with check (
    (setor = 'Geral' and public.is_admin())
    or (setor <> 'Geral' and public.is_manager(setor::public.setor))
  );

create policy "pops_manager_update"
  on public.pops for update
  using (
    (setor = 'Geral' and public.is_admin())
    or (setor <> 'Geral' and public.is_manager(setor::public.setor))
  )
  with check (
    (setor = 'Geral' and public.is_admin())
    or (setor <> 'Geral' and public.is_manager(setor::public.setor))
  );

create policy "pops_admin_delete"
  on public.pops for delete
  using (public.is_admin());

-- pop-anexos precisa acompanhar a mesma mudança: Gestor do setor agora
-- também gerencia POP's do próprio setor, então precisa poder subir/ver
-- anexos e fotos de etapa. Convenção de path vira <setor>/<pop_id>/<arquivo>
-- (igual a fichas-imagens/mapas-imagens) — 'Geral' nunca casa com
-- public.setor, então fica explicitamente admin-only.
drop policy "pop_anexos_select" on storage.objects;
drop policy "pop_anexos_write" on storage.objects;

create policy "pop_anexos_select"
  on storage.objects for select
  using (
    bucket_id = 'pop-anexos' and (
      public.is_admin()
      or (storage.foldername(name))[1] = 'Geral'
      or (storage.foldername(name))[1] = public.user_setor()::text
    )
  );

create policy "pop_anexos_write"
  on storage.objects for insert
  with check (
    bucket_id = 'pop-anexos' and (
      ((storage.foldername(name))[1] = 'Geral' and public.is_admin())
      or ((storage.foldername(name))[1] <> 'Geral' and public.is_manager(nullif((storage.foldername(name))[1], '')::public.setor))
    )
  );
