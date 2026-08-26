-- 0003_mensagens.sql
-- Mensagens Importantes — segundo exemplo de Realtime (mensagem nova chega
-- pros setores certos na hora, sem F5).

create table public.mensagens (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  destino text not null,              -- 'Todos' | 'Bar' | 'Cozinha' | 'Salão' (texto livre pra caber 'Todos' fora do enum setor)
  author_id uuid not null references public.profiles(id),
  author_nome text not null,
  created_at timestamptz not null default now(),
  constraint destino_valido check (destino in ('Todos', 'Bar', 'Cozinha', 'Salão'))
);

alter table public.mensagens enable row level security;

-- Administrador vê tudo; os demais só 'Todos' + a própria setor.
create policy "mensagens_select"
  on public.mensagens for select
  using (public.is_admin() or destino = 'Todos' or destino = public.user_setor()::text);

-- Só Gestor/Administrador publica; Gestor de setor só pode mandar pro
-- próprio setor (nunca 'Todos' nem outro setor) — mesma trava do protótipo.
create policy "mensagens_insert_manager"
  on public.mensagens for insert
  with check (
    author_id = auth.uid()
    and (public.is_admin() or (public.is_setor_manager() and destino = public.user_setor()::text))
  );

create policy "mensagens_delete_manager"
  on public.mensagens for delete
  using (public.is_admin() or (public.is_setor_manager() and destino = public.user_setor()::text));

alter publication supabase_realtime add table public.mensagens;
