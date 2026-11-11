-- 0051_gestor_geral_enum.sql
-- Novo perfil "Gestor Geral": tudo que o Administrador faz, exceto apagar
-- (apagar vira um pedido de autorização — ver 0052).
--
-- Fica sozinha neste arquivo porque um valor novo de enum só pode ser USADO
-- depois que a transação que o criou termina; a 0052 já usa 'gestor_geral'.
alter type public.user_role add value if not exists 'gestor_geral';
