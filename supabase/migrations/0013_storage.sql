-- 0013_storage.sql
-- Buckets do Supabase Storage + policies. Convenção de caminho:
-- `<setor>/<...>/<arquivo>` — o primeiro segmento do path é sempre o setor,
-- e é isso que a policy usa pra decidir quem pode ler/escrever (mesma regra
-- das tabelas: Administrador tudo, resto só o próprio setor).

insert into storage.buckets (id, name, public) values
  ('checklist-fotos', 'checklist-fotos', false),
  ('fichas-imagens', 'fichas-imagens', false),
  ('mapas-imagens', 'mapas-imagens', false),
  ('pop-anexos', 'pop-anexos', false)
on conflict (id) do nothing;

-- checklist-fotos: qualquer perfil do setor sobe a foto de conclusão; leitura
-- igual à das tarefas (próprio setor ou Administrador).
create policy "checklist_fotos_select"
  on storage.objects for select
  using (bucket_id = 'checklist-fotos' and (public.is_admin() or (storage.foldername(name))[1] = public.user_setor()::text));

create policy "checklist_fotos_insert"
  on storage.objects for insert
  with check (bucket_id = 'checklist-fotos' and (public.is_admin() or (storage.foldername(name))[1] = public.user_setor()::text));

-- fichas-imagens / mapas-imagens / pop-anexos: conteúdo gerenciado, só quem
-- tem is_manager() do setor escreve; leitura segue a mesma regra das tabelas
-- (setor próprio ou Administrador).
create policy "fichas_imagens_select"
  on storage.objects for select
  using (bucket_id = 'fichas-imagens' and (public.is_admin() or (storage.foldername(name))[1] = public.user_setor()::text));
create policy "fichas_imagens_write"
  on storage.objects for insert
  with check (bucket_id = 'fichas-imagens' and public.is_manager(nullif((storage.foldername(name))[1], '')::public.setor));

create policy "mapas_imagens_select"
  on storage.objects for select
  using (bucket_id = 'mapas-imagens' and (public.is_admin() or (storage.foldername(name))[1] = public.user_setor()::text));
create policy "mapas_imagens_write"
  on storage.objects for insert
  with check (bucket_id = 'mapas-imagens' and public.is_manager(nullif((storage.foldername(name))[1], '')::public.setor));

create policy "pop_anexos_select"
  on storage.objects for select
  using (bucket_id = 'pop-anexos' and public.is_admin());
create policy "pop_anexos_write"
  on storage.objects for insert
  with check (bucket_id = 'pop-anexos' and public.is_admin());
