-- 0012_impressao.sql
-- Configuração de impressoras + fila/histórico de impressão. `linguagem` fica
-- aberta (TSPL/ZPL/Outro) porque o serviço de impressão é por adaptadores —
-- ver src/lib/printing no app. `protocolo_confirmado` existe justamente pra
-- não assumir que qualquer impressora Bluetooth aceita TSPL: a impressão
-- direta só habilita depois de alguém confirmar o protocolo daquele modelo.

create type public.printer_conexao as enum ('Bluetooth', 'USB', 'Rede');
create type public.printer_linguagem as enum ('TSPL', 'ZPL', 'Outro');
create type public.print_status as enum ('Pendente', 'Enviando', 'Impressa', 'Falhou', 'Reimprimir');

create table public.printers (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  modelo text not null,
  conexao public.printer_conexao not null,
  endereco text,   -- MAC (Bluetooth) / IP (rede) / device path (USB)
  linguagem public.printer_linguagem not null default 'TSPL',
  largura_mm numeric(6, 2) not null default 50,
  altura_mm numeric(6, 2) not null default 30,
  espacamento_mm numeric(6, 2) not null default 2,
  densidade integer,
  velocidade integer,
  protocolo_confirmado boolean not null default false,
  ativa boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger printers_set_updated_at
  before update on public.printers
  for each row execute function public.set_updated_at();

create table public.print_jobs (
  id uuid primary key default gen_random_uuid(),
  printer_id uuid references public.printers(id),
  lote_id uuid references public.fichas_producao_lotes(id),
  quantidade_etiquetas integer not null,
  conteudo jsonb not null,   -- {produto, preparo, validade, armazenar, responsavel, quantidade}
  status public.print_status not null default 'Pendente',
  tentativas integer not null default 0,
  erro text,
  responsavel_id uuid not null references public.profiles(id),
  responsavel_nome text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  impressa_em timestamptz
);

create trigger print_jobs_set_updated_at
  before update on public.print_jobs
  for each row execute function public.set_updated_at();

alter table public.printers enable row level security;
alter table public.print_jobs enable row level security;

create policy "printers_select_all"
  on public.printers for select using (true);

create policy "printers_manager_write"
  on public.printers for all
  using (public.is_manager()) with check (public.is_manager());

create policy "print_jobs_select"
  on public.print_jobs for select
  using (public.is_admin() or responsavel_id = auth.uid());

create policy "print_jobs_insert"
  on public.print_jobs for insert
  with check (responsavel_id = auth.uid());

create policy "print_jobs_update"
  on public.print_jobs for update
  using (public.is_admin() or responsavel_id = auth.uid())
  with check (public.is_admin() or responsavel_id = auth.uid());

alter publication supabase_realtime add table public.print_jobs;
