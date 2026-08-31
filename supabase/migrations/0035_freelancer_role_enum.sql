-- 0035_freelancer_role_enum.sql
-- Pedido do usuário: um perfil de login pra freelancers. Só o ADD VALUE vai
-- aqui, sozinho — Postgres não deixa usar um valor novo de enum na mesma
-- transação em que ele foi criado, então tudo que referencia 'freelancer'
-- (colunas, policies, funções) fica na migration seguinte (0036).
alter type public.user_role add value 'freelancer';
