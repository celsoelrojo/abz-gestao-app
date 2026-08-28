-- 0024_estoque_cadastro_produto.sql
-- Novo botão "Cadastrar Produto" no submenu de Estoque e Compras — pedido do
-- usuário pra virar a BASE de todo o resto do módulo (Entrada, Retirada,
-- Limites, Compras continuam lendo/gravando em estoque_itens, só ganham mais
-- metadado por trás). Por isso os campos entram na própria estoque_itens, em
-- vez de uma tabela nova: um item já É o "produto" cadastrado por setor.
--
-- Campos pedidos que a tabela já tinha (não duplicados aqui): Setor
-- (categoria), Nome do produto (title), Categoria/Subcategoria
-- (produto_categoria/subcategoria, com sugestões via taxonomias), Unidade de
-- medida (unidade).

create type public.estoque_tipo_produto as enum ('Matéria Prima', 'Remanufaturado', 'Pronto para Venda');

alter table public.estoque_itens
  add column tipo_produto public.estoque_tipo_produto not null default 'Matéria Prima',
  add column marca text,
  add column volume_padrao numeric(10, 3),
  add column condicao_armazenamento text,
  -- Prazo de validade (só remanufaturado) — mesmo par numeric+enum já usado
  -- em fichas_producao.prazo_validade/unidade_validade, pra manter o mesmo
  -- vocabulário (Horas/Dias/Semanas/Meses) no app inteiro.
  add column prazo_validade numeric,
  add column unidade_validade text check (unidade_validade in ('Horas', 'Dias', 'Semanas', 'Meses')),
  -- Vínculo com a Ficha de Produção que prepara este item remanufaturado
  -- (item 10 do pedido). Fica null pra Matéria Prima/Pronto para Venda.
  add column ficha_producao_id uuid references public.fichas_producao(id);

comment on column public.estoque_itens.tipo_produto is 'Matéria Prima, Remanufaturado ou Pronto para Venda — define quais campos extras (prazo de validade, ficha de preparo) fazem sentido no cadastro.';
comment on column public.estoque_itens.ficha_producao_id is 'Só preenchido quando tipo_produto = Remanufaturado: aponta pra ficha de preparo (fichas_producao) que gera este item.';
