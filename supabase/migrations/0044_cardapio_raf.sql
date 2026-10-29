-- 0044_cardapio_raf.sql
-- Pedido do usuário: módulo "Cardápio RAF", exclusivo da Cozinha e da
-- Administração, com os submódulos Adicionar cardápio e Visualizar cardápio.
--
-- Um cardápio é um documento: nome + observações + a lista de itens
-- (seção, nome, descrição, preço). Os itens ficam em jsonb na própria linha
-- (mesmo padrão de fichas_producao.ingredientes) pra salvar/editar o cardápio
-- inteiro de forma atômica, sem tabela filha nem rollback manual.
--   itens: [{ id, secao, nome, descricao, preco }]  (preco = número ou null)
create table public.cardapios (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (btrim(nome) <> ''),
  observacoes text,
  itens jsonb not null default '[]' check (jsonb_typeof(itens) = 'array'),
  criado_por uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger cardapios_set_updated_at
  before update on public.cardapios
  for each row execute function public.set_updated_at();

alter table public.cardapios enable row level security;

-- Acesso: Administrador + qualquer perfil do setor Cozinha — menos o perfil
-- freelancer, que tem setor mas não pode ver nada fora de Checklist/Sobre nós.
-- Anônimo: user_setor() é null, a comparação dá null e a policy nega.
create policy "cardapios_select"
  on public.cardapios for select
  using (public.is_admin() or (public.user_setor() = 'Cozinha' and public.current_role_name() <> 'freelancer'));

create policy "cardapios_insert"
  on public.cardapios for insert
  with check (public.is_admin() or (public.user_setor() = 'Cozinha' and public.current_role_name() <> 'freelancer'));

create policy "cardapios_update"
  on public.cardapios for update
  using (public.is_admin() or (public.user_setor() = 'Cozinha' and public.current_role_name() <> 'freelancer'))
  with check (public.is_admin() or (public.user_setor() = 'Cozinha' and public.current_role_name() <> 'freelancer'));

-- Excluir um cardápio inteiro é mais pesado que editar: só Administrador ou
-- Gestor da Cozinha.
create policy "cardapios_delete"
  on public.cardapios for delete
  using (public.is_manager('Cozinha'));

create trigger audit_cardapios after insert or update or delete on public.cardapios
  for each row execute function public.audit_trigger_fn();

alter publication supabase_realtime add table public.cardapios;
