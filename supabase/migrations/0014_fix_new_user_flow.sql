-- 0014_fix_new_user_flow.sql
-- Corrige "Database error creating new user": o formulário padrão de
-- "Add user" do painel Supabase cria o usuário SEM metadata na primeira
-- tentativa (só dá pra editar depois) — o trigger handle_new_user então cai
-- no default (role='salao', setor=null), o que violava a constraint
-- setor_obrigatorio_para_nao_admin e cancelava a criação inteira.
--
-- Agora essa regra só é cobrada quando a conta está 'ativa' — dá pra criar a
-- conta "pendente" (sem metadata nenhuma) e completar role/setor depois pela
-- tela Gerenciar Contas, antes de ativar.

alter table public.profiles drop constraint setor_obrigatorio_para_nao_admin;

alter table public.profiles add constraint setor_obrigatorio_para_nao_admin check (
  status <> 'ativa'
  or (role = 'administrador' and setor is null)
  or (role <> 'administrador' and setor is not null)
);
