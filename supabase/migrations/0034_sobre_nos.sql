-- 0034_sobre_nos.sql
-- Módulo novo "Sobre nós" — pedido do usuário: 3 submódulos fixos (não é
-- uma lista que o usuário cria/apaga, são 3 seções conhecidas de antemão),
-- cada um com um texto rico (negrito/itálico/sublinhado/tamanho de fonte).
-- Por isso uma tabela com `chave` fixa (check, não precisa de enum próprio
-- pra só 3 valores) em vez do padrão "categoria + itens" usado em POP's/Mapas.
-- Conteúdo só editável pelo Administrador (não há Gestor de setor aqui —
-- isso é cultura da empresa inteira, não por setor), leitura liberada pra
-- qualquer perfil logado — mesmo padrão de "using (true)" no select já usado
-- em taxonomias/pop_categories/printers/reserva_capacidade.
create table public.sobre_nos_secoes (
  chave text primary key check (chave in ('historia', 'time', 'cargos')),
  titulo text not null,
  conteudo_html text not null default '',
  atualizado_por uuid references public.profiles(id),
  atualizado_em timestamptz not null default now()
);

insert into public.sobre_nos_secoes (chave, titulo) values
  ('historia', 'Nossa história, missão, visão e valores'),
  ('time', 'O que esperamos do nosso time'),
  ('cargos', 'Cargos e funções');

alter table public.sobre_nos_secoes enable row level security;

create policy "sobre_nos_secoes_select_all"
  on public.sobre_nos_secoes for select using (true);

create policy "sobre_nos_secoes_update_admin"
  on public.sobre_nos_secoes for update
  using (public.is_admin())
  with check (public.is_admin());

alter publication supabase_realtime add table public.sobre_nos_secoes;
