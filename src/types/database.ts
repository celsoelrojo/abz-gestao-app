// Tipos escritos à mão pra bater com as migrations (supabase/migrations/),
// seguindo o MESMO formato que `supabase gen types typescript` gera de
// verdade (Row/Insert/Update/Relationships por tabela, + Views/Functions/
// Enums/CompositeTypes) — assim o supabase-js resolve os tipos de
// from()/rpc() corretamente. Assim que houver um projeto Supabase real,
// troque por tipos gerados de verdade:
// `npx supabase gen types typescript --project-id SEU_ID > src/types/database.ts`
// Cobre por enquanto as tabelas/funções já usadas pelos módulos de
// referência (profiles, checklist, printers/print_jobs).
//
// IMPORTANTE: use sempre `type X = {...}`, nunca `interface X {...}` aqui.
// Interfaces não recebem a "implicit index signature" que os object types
// ganham, então falham silenciosamente o constraint `Record<string, unknown>`
// do GenericTable/GenericSchema do postgrest-js — e todo o schema colapsa
// para `never`, quebrando o tipo de insert/update/rpc (mas não de select).

export type UserRole =
  | 'administrador'
  | 'gestor_bar'
  | 'gestor_cozinha'
  | 'gestor_salao'
  | 'bar'
  | 'cozinha'
  | 'salao'

export type Setor = 'Bar' | 'Cozinha' | 'Salão'
export type Periodicidade = 'Diária' | 'Semanal' | 'Quinzenal' | 'Mensal' | 'A cada turno' | 'Única'
export type Weekday = 'Segunda' | 'Terça' | 'Quarta' | 'Quinta' | 'Sexta' | 'Sábado' | 'Domingo'

export type ProfileRow = {
  id: string
  nome: string
  username: string
  role: UserRole
  setor: Setor | null
  status: 'ativa' | 'pendente' | 'bloqueada'
  created_at: string
  updated_at: string
}

export type ChecklistTaskRow = {
  id: number
  setor: Setor
  title: string
  description: string
  responsavel_nome: string
  periodicidade: Periodicidade
  dias: Weekday[]
  data_unica: string | null
  semanas_do_mes: string[]
  vinculo_tipo: string | null
  vinculo_id: string | null
  envolve_producao: boolean
  producao_vinculada_id: string | null
  foto_obrigatoria: boolean
  freelancer_pagamento: boolean
  freelancer_escala_id: string | null
  active: boolean
  posicao: number
  created_at: string
  updated_at: string
}

export type ChecklistConclusaoRow = {
  id: string
  task_id: number
  data_referencia: string
  completed_by: string
  completed_at: string
  foto_url: string | null
  justificativa_atraso: string | null
  justificativa_atraso_missed_date: string | null
  justificativa_atraso_days_late: number | null
  justificativa_atraso_dismissed: boolean
  antecipacao_data_programada: string | null
  antecipacao_justificativa: string | null
  lote_id: string | null
  movimento_estoque_id: string | null
  created_at: string
}

export type PrinterRow = {
  id: string
  nome: string
  modelo: string
  conexao: 'Bluetooth' | 'USB' | 'Rede'
  endereco: string | null
  linguagem: 'TSPL' | 'ZPL' | 'Outro'
  largura_mm: number
  altura_mm: number
  espacamento_mm: number
  densidade: number | null
  velocidade: number | null
  protocolo_confirmado: boolean
  ativa: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export type PrintJobRow = {
  id: string
  printer_id: string | null
  lote_id: string | null
  quantidade_etiquetas: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  conteudo: any
  status: 'Pendente' | 'Enviando' | 'Impressa' | 'Falhou' | 'Reimprimir'
  tentativas: number
  erro: string | null
  responsavel_id: string
  responsavel_nome: string
  created_at: string
  updated_at: string
  impressa_em: string | null
}

// As 4 abaixo cobrem só os campos usados pelo picker de vínculo do
// Checklist (Mapa/POP/Ficha de Produção) — os módulos em si (CRUD completo,
// blocos, ingredientes etc.) ainda não têm tela nesta app, só no protótipo.
export type MapaFluxogramaRow = {
  id: string
  kind: 'mapa' | 'fluxograma'
  setor: Setor
  title: string
}

export type PopRow = {
  id: string
  titulo: string
  setor: string
  status: 'rascunho' | 'publicada' | 'inativa'
}

export type FichaTecnicaRow = {
  id: string
  nome: string
  setor: string
  status: 'rascunho' | 'publicada' | 'inativa'
}

export type FichaProducaoRow = {
  id: string
  nome: string
  setor: string
  status: 'rascunho' | 'publicada' | 'inativa'
}

export type EstoqueCategoria = 'Bar' | 'Cozinha' | 'Salão' | 'Material de Limpeza' | 'Outros'
export type EstoqueUnidade = 'Caixa' | 'Unidade' | 'Quilo' | 'Litro' | 'Grama' | 'Mililitro' | 'Pacote' | 'Fardo'
export type MotivoRetirada = 'Produção' | 'Uso interno' | 'Perda' | 'Vencimento' | 'Quebra' | 'Transferência' | 'Outro'
export type EstoqueMovimentoTipo = 'Entrada Manual' | 'Entrada por Produção' | 'Saída de Estoque' | 'Estorno de Retirada'

export type EstoqueItemRow = {
  id: string
  categoria: EstoqueCategoria
  title: string
  quantidade: number
  unidade: EstoqueUnidade
  produto_categoria: string | null
  subcategoria: string | null
  min: number | null
  medio: number | null
  max: number | null
  validade: string | null
  created_at: string
  updated_at: string
}

export type EstoqueMovimentoRow = {
  id: string
  item_id: string
  tipo: EstoqueMovimentoTipo
  categoria: EstoqueCategoria
  produto: string
  produto_categoria: string | null
  quantidade: number
  unidade: EstoqueUnidade
  data_hora: string
  numero_lote: string | null
  validade: string | null
  motivo: MotivoRetirada | null
  responsavel_id: string | null
  responsavel_nome: string
  observacao: string | null
  tarefa_origem_id: number | null
  lote_id: string | null
  estornada: boolean
  estorno_de_id: string | null
  created_at: string
}

export type TaxonomiaRow = {
  id: string
  modulo: 'ficha_tecnica' | 'ficha_producao' | 'estoque'
  setor: string
  tipo: 'categoria' | 'subcategoria'
  valor: string
}

export type MensagemDestino = 'Bar' | 'Cozinha' | 'Salão' | 'Todos'

export type MensagemRow = {
  id: string
  content: string
  destino: MensagemDestino
  author_id: string
  author_nome: string
  created_at: string
}

export type ReservaStatus =
  | 'pendente'
  | 'confirmada'
  | 'cancelada'
  | 'cliente_chegou'
  | 'em_atendimento'
  | 'concluida'
  | 'nao_compareceu'
export type ReservaPeriodo = 'Almoço' | 'Noite'

export type ReservaHistoricoEntry = {
  data: string
  tipo: 'criacao' | 'confirmacao' | 'cancelamento' | 'mudanca_mesa'
  autor: string
  detalhe?: string | null
}

export type ReservaRow = {
  id: string
  nome_cliente: string
  telefone: string | null
  email: string | null
  instagram: string | null
  origem: string | null
  data: string
  horario: string | null
  periodo: ReservaPeriodo
  quantidade_pessoas: number
  mesa: string | null
  ocasiao: string | null
  observacoes: string | null
  restricoes: string | null
  responsavel: string | null
  status: ReservaStatus
  sinal: string | null
  criado_por: string | null
  motivo_cancelamento: string | null
  cancelada_por: string | null
  cancelada_em: string | null
  historico: ReservaHistoricoEntry[]
  created_at: string
  updated_at: string
}

export type ReservaSemContatoRow = Omit<ReservaRow, 'telefone' | 'email' | 'instagram'>

export type ReservaCapacidadeRow = {
  periodo: ReservaPeriodo
  capacidade: number
}

// Só os campos usados pelo resumo "Freelancers hoje" do painel de Mensagens
// Importantes — o módulo Freelancer em si (CRUD completo) não tem tela
// própria nesta app ainda.
export type FreelancerEscalaRow = {
  id: string
  freelancer_id: string
  data: string
  setor: Setor
  periodo: ReservaPeriodo
  hora_inicio: string | null
  hora_fim: string | null
  valor_pagamento: number | null
  funcao_turno: string | null
  observacoes: string | null
  tarefa_pagamento_id: number | null
  created_at: string
  updated_at: string
}

export type AuditLogRow = {
  id: number
  table_name: string
  record_id: string
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  actor_id: string | null
  actor_nome: string | null
  changed_at: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  old_data: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new_data: any
}

type TableDef<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] }
type ViewDef<Row> = { Row: Row; Relationships: [] }

export type Database = {
  public: {
    Tables: {
      profiles: TableDef<ProfileRow>
      checklist_tasks: TableDef<ChecklistTaskRow>
      checklist_conclusoes: TableDef<ChecklistConclusaoRow>
      printers: TableDef<PrinterRow>
      print_jobs: TableDef<PrintJobRow>
      audit_log: TableDef<AuditLogRow>
      mapas_fluxogramas: TableDef<MapaFluxogramaRow>
      pops: TableDef<PopRow>
      fichas_tecnicas: TableDef<FichaTecnicaRow>
      fichas_producao: TableDef<FichaProducaoRow>
      estoque_itens: TableDef<EstoqueItemRow>
      estoque_movimentos: TableDef<EstoqueMovimentoRow>
      taxonomias: TableDef<TaxonomiaRow>
      mensagens: TableDef<MensagemRow>
      reservas: TableDef<ReservaRow>
      reserva_capacidade: TableDef<ReservaCapacidadeRow>
      freelancer_escalas: TableDef<FreelancerEscalaRow>
    }
    Views: {
      reservas_sem_contato: ViewDef<ReservaSemContatoRow>
    }
    Functions: {
      email_for_username: { Args: { p_username: string }; Returns: string }
      resolve_justificativa_atraso: { Args: { p_conclusao_id: string }; Returns: undefined }
      registrar_entrada_estoque: {
        Args: {
          p_item_id: string
          p_quantidade: number
          p_tipo: string
          p_data_hora: string
          p_numero_lote?: string | null
          p_validade?: string | null
          p_observacao?: string | null
          p_tarefa_origem_id?: number | null
          p_lote_id?: string | null
        }
        Returns: EstoqueMovimentoRow
      }
      registrar_saida_estoque: {
        Args: {
          p_item_id: string
          p_quantidade: number
          p_motivo: string
          p_data_hora: string
          p_observacao?: string | null
        }
        Returns: EstoqueMovimentoRow
      }
      estornar_retirada_estoque: { Args: { p_movimento_id: string }; Returns: EstoqueMovimentoRow }
      reservas_hoje_resumo: {
        Args: Record<string, never>
        Returns: { periodo: ReservaPeriodo; total_pessoas: number }[]
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
