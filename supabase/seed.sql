-- seed.sql — dados de desenvolvimento (rodar DEPOIS das migrations).
-- Contas de usuário (auth.users) não são criadas aqui: crie-as pelo painel
-- Supabase (Authentication → Add user) ou `supabase auth` CLI, passando em
-- "user metadata" os campos nome/username/role/setor/status — o trigger
-- handle_new_user (migration 0001) cria o profile sozinho. Ver README para
-- os 7 perfis de exemplo e suas credenciais sugeridas.

insert into public.pop_categories (name, ordem) values
  ('Preparo', 1), ('Higienização', 2), ('Máquinas', 3), ('Atendimento', 4), ('Segurança', 5);

insert into public.estoque_itens (categoria, title, quantidade, unidade, produto_categoria, min, medio, max) values
  ('Bar', 'Vodka', 8, 'Unidade', 'Bebidas', 4, 15, 25),
  ('Bar', 'Gin', 5, 'Unidade', 'Bebidas', 6, 12, 20),
  ('Bar', 'Cerveja long neck', 42, 'Unidade', 'Bebidas', 20, 60, 100),
  ('Cozinha', 'Frango', 12, 'Quilo', 'Carnes', 5, 20, 35),
  ('Cozinha', 'Óleo de fritura', 6, 'Litro', null, 3, 10, 15),
  ('Cozinha', 'Farinha de trigo', 8, 'Quilo', 'Cereais e Grãos', 10, 15, 25),
  ('Salão', 'Guardanapos', 300, 'Unidade', null, 100, 500, 800),
  ('Salão', 'Toalhas de mesa', 40, 'Unidade', null, 20, 50, 70),
  ('Salão', 'Velas decorativas', 25, 'Unidade', null, 30, 40, 60);

insert into public.taxonomias (modulo, setor, tipo, valor) values
  ('estoque', 'Bar', 'categoria', 'Polpas'),
  ('estoque', 'Bar', 'categoria', 'Xaropes'),
  ('estoque', 'Bar', 'categoria', 'Bebidas'),
  ('estoque', 'Cozinha', 'categoria', 'Carnes'),
  ('estoque', 'Cozinha', 'categoria', 'Hortifruti'),
  ('estoque', 'Cozinha', 'categoria', 'Cereais e Grãos'),
  ('estoque', 'Cozinha', 'categoria', 'Temperos'),
  ('ficha_tecnica', 'Bar', 'categoria', 'Drinks'),
  ('ficha_tecnica', 'Cozinha', 'categoria', 'Petiscos');

-- Tarefas de checklist não dependem de profiles (responsavel_nome é texto
-- livre), então dá pra semear sem ter conta criada ainda.
insert into public.checklist_tasks (setor, title, description, responsavel_nome, periodicidade, dias) values
  ('Bar', 'Conferir gelo', 'Verificar quantidade e qualidade do gelo nas máquinas e baldes.', 'Carlos Silva', 'A cada turno', '{}'),
  ('Cozinha', 'Conferir gás e equipamentos de segurança', '', 'Mariana Alves', 'Semanal', '{Segunda}'),
  ('Salão', 'Testar iluminação e som ambiente', '', 'Beatriz Nunes', 'Semanal', '{Sexta}'),
  ('Salão', 'Higienizar banheiros', '', 'Rafael Souza', 'A cada turno', '{}');

update public.checklist_tasks set foto_obrigatoria = true where title = 'Higienizar banheiros';
