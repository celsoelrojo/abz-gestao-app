-- 0022_taxonomias_pop.sql
-- POP's reaproveita a tabela genérica taxonomias pra sugestão de
-- subcategoria por setor (mesmo padrão de Estoque/Fichas Técnicas/Fichas de
-- Produção) — só falta 'pop' no check constraint de modulo.
alter table public.taxonomias drop constraint taxonomias_modulo_check;
alter table public.taxonomias add constraint taxonomias_modulo_check
  check (modulo in ('ficha_tecnica', 'ficha_producao', 'estoque', 'pop'));
