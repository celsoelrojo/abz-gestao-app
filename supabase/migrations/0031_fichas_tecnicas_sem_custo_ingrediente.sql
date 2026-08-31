-- 0031_fichas_tecnicas_sem_custo_ingrediente.sql
-- Ingrediente de Ficha Técnica passa a ser sempre um produto vinculado ao
-- estoque (campo `estoqueItemId`), substituindo os campos livres `nome`/
-- `unidade` — mesma mudança já feita em Ficha de Produção. A view
-- fichas_tecnicas_sem_custo (0006) projetava explicitamente 'nome'/'unidade'
-- de dentro do jsonb de cada ingrediente; troca pra 'estoqueItemId'.
create or replace view public.fichas_tecnicas_sem_custo as
  select
    id, nome, setor, codigo, categoria, subcategoria, foto_principal_url,
    (select jsonb_agg(jsonb_build_object(
        'id', i->>'id', 'estoqueItemId', i->>'estoqueItemId',
        'qtdBruta', i->'qtdBruta', 'qtdLiquida', i->'qtdLiquida', 'fatorCorrecao', i->'fatorCorrecao'
      )) from jsonb_array_elements(ingredientes) i) as ingredientes,
    etapas, utensilios, equipamentos, padrao_apresentacao, boas_praticas, epis, tempo_preparo,
    alergenicos, info_nutricional, observacoes_gerais, padrao_qualidade, criterios_reprovacao,
    vinculos, criado_por, criado_em, ultima_revisao_em, publicado_por, publicado_em, versao, status
  from public.fichas_tecnicas
  where status = 'publicada';
