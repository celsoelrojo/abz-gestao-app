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
  | 'freelancer'

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

// Recorte mínimo de checklist_tasks (só campos de agenda, sem título/
// descrição/responsável) devolvido por checklist_agenda_todos_setores() —
// usado pra montar a barra "tarefas gerais do estabelecimento" na Home, que
// precisa somar todos os setores mesmo a RLS de checklist_tasks só deixando
// cada perfil ver o próprio.
export type ChecklistAgendaRow = {
  id: number
  setor: Setor
  periodicidade: Periodicidade
  dias: Weekday[]
  data_unica: string | null
  semanas_do_mes: string[]
}

export type ChecklistConcluidaRow = {
  task_id: number
  setor: Setor
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

export type MapaBlockTipo = 'text' | 'image'

export type MapaBlockRow = {
  id: string
  mapa_id: string
  type: MapaBlockTipo
  title: string
  content: string | null
  image_url: string | null
  ordem: number
  created_at: string
}

export type MapaFluxogramaRow = {
  id: string
  kind: 'mapa' | 'fluxograma'
  setor: Setor
  title: string
  ordem: number
  created_at: string
  updated_at: string
}

export type PopStatus = 'rascunho' | 'publicada' | 'inativa'

export type PopCategoryRow = {
  id: string
  name: string
  ordem: number
}

export type PopResponsabilidade = { cargo: string; responsabilidade: string }
export type PopMaterial = { descricao: string }
export type PopEtapa = {
  titulo: string
  descricao: string
  tempo: string | null
  temperatura: string | null
  frequencia: string | null
  observacao: string | null
  foto_url: string | null
}
export type PopAcaoCorretiva = { descricao: string }
export type PopAnexo = { nome: string; url: string }
export type PopHistoricoTipo = 'criacao' | 'revisao' | 'publicacao'
export type PopHistoricoEntry = { data: string; tipo: PopHistoricoTipo; autor: string }
export type PopVinculoTipo = 'Mapa' | 'POP'
export type PopVinculo = { tipo: PopVinculoTipo; id: string }

export type PopRow = {
  id: string
  titulo: string
  codigo: string | null
  setor: 'Bar' | 'Cozinha' | 'Salão' | 'Geral'
  category_id: string | null
  subcategoria: string | null
  estabelecimento: string
  elaborado_por: string | null
  aprovado_por: string | null
  data_emissao: string
  versao: number
  ultima_revisao_em: string
  proxima_revisao: string | null
  status: PopStatus
  publicado_por: string | null
  publicado_em: string | null
  objetivo: string
  aplicacao: string
  setores_aplicaveis: string[]
  aplica_a_todos: boolean
  responsabilidades: PopResponsabilidade[]
  materiais: PopMaterial[]
  etapas: PopEtapa[]
  seguranca: string
  alerta_importante: string | null
  frequencia: string
  situacoes_especificas: string | null
  monitoramento: string
  responsavel_monitoramento: string | null
  checklist_vinculado_id: number | null
  local_registro: string | null
  acoes_corretivas: PopAcaoCorretiva[]
  referencias: string | null
  anexos: PopAnexo[]
  vinculos: PopVinculo[]
  historico: PopHistoricoEntry[]
  ordem: number
  created_at: string
  updated_at: string
}

export type FreelancerRow = {
  id: string
  nome: string
  setor: Setor
  funcao: string
  telefone: string
  email: string | null
  observacoes: string | null
  status: 'ativo' | 'inativo'
  profile_id: string | null
  created_at: string
  updated_at: string
}

export type FichaStatus = 'rascunho' | 'publicada' | 'inativa'

// Pedido do usuário: o ingrediente passa a ser sempre um produto já
// cadastrado no estoque (nome/unidade vêm de lá), igual ao que já foi feito
// em ProducaoIngrediente — nome/unidade livres saem daqui.
export type FichaIngredienteTecnica = {
  id: string
  estoqueItemId: string
  qtdBruta: number | null
  qtdLiquida: number | null
  fatorCorrecao: number | null
  qtdBase: number | null
  precoBase: number | null
}

export type FichaEtapa = {
  id: string
  titulo: string
  descricao: string
  imagens: string[]
}

export type FichaVinculoTipo = 'Mapa' | 'POP' | 'Ficha Técnica'

export type FichaVinculo = {
  tipo: FichaVinculoTipo
  id: string
}

export type FichaTecnicaRow = {
  id: string
  nome: string
  setor: string
  codigo: string | null
  categoria: string | null
  subcategoria: string | null
  foto_principal_url: string | null
  ingredientes: FichaIngredienteTecnica[]
  embalagem: number | null
  preco_sugerido: number | null
  etapas: FichaEtapa[]
  utensilios: string | null
  equipamentos: string | null
  padrao_apresentacao: string | null
  boas_praticas: string | null
  epis: string | null
  tempo_preparo: string | null
  alergenicos: string | null
  info_nutricional: string | null
  observacoes_gerais: string | null
  padrao_qualidade: string | null
  criterios_reprovacao: string | null
  vinculos: FichaVinculo[]
  criado_por: string | null
  criado_em: string
  ultima_revisao_em: string | null
  publicado_por: string | null
  publicado_em: string | null
  versao: number
  status: FichaStatus
  created_at: string
  updated_at: string
}

// Mesma forma da tabela base, sem embalagem/preco_sugerido e sem
// qtdBase/precoBase dentro de cada ingrediente — o que a view
// fichas_tecnicas_sem_custo devolve.
export type FichaTecnicaSemCustoRow = Omit<FichaTecnicaRow, 'embalagem' | 'preco_sugerido' | 'ingredientes'> & {
  ingredientes: Omit<FichaIngredienteTecnica, 'qtdBase' | 'precoBase'>[]
}

// Ingrediente da Ficha de Produção — reformulado a pedido do usuário: o
// produto agora É um item real do estoque (não texto livre), então nome/
// unidade vêm de lá; custo unitário é sempre "por unidade do produto
// vinculado" (kg/L/un, o que o estoque_itens.unidade daquele item disser).
export type ProducaoIngrediente = {
  id: string
  estoqueItemId: string
  quantidade: number | null
  custoUnitario: number | null
  percentualPerda: number | null
}

// Etapa do modo de preparo — reformulada a pedido do usuário: só título,
// descrição, equipamento usado e foto(s). Tempo/temperatura/utensílios/ponto
// de controle saíram do formulário (existiam antes, sem pedido explícito).
export type ProducaoEtapa = {
  id: string
  titulo: string
  descricao: string
  equipamento: string | null
  imagens: string[]
}

export type ProducaoCondicaoArmazenamento = 'Ambiente' | 'Resfriado' | 'Congelado'
export type ProducaoRendimentoUnidade = 'Litros' | 'Quilos' | 'Unidade' | 'Porção'

// Vínculo próprio da Ficha de Produção — pedido do usuário: "Mapa/POP/Ficha
// de produção" (não "Ficha Técnica" como em FichaVinculoTipo, usado só por
// fichas_tecnicas). "Ficha de Produção" como rótulo busca em Fichas Técnicas
// E Fichas de Produção publicadas — mesma semântica do vínculo do Checklist,
// ver src/lib/vinculo.ts.
export type ProducaoVinculoTipo = 'Mapa' | 'POP' | 'Ficha de Produção'
export type ProducaoVinculo = { tipo: ProducaoVinculoTipo; id: string }

export type FichaProducaoHistoricoTipo = 'criacao' | 'revisao' | 'publicacao'

export type FichaProducaoHistoricoEntry = {
  data: string
  tipo: FichaProducaoHistoricoTipo
  autor: string
}

export type UnidadeValidade = 'Horas' | 'Dias' | 'Semanas' | 'Meses'

export type FichaProducaoRow = {
  id: string
  nome: string
  setor: string
  codigo: string | null
  categoria: string | null
  foto_principal_url: string | null
  fichas_tecnicas_vinculadas: string[]
  ingredientes: ProducaoIngrediente[]
  etapas: ProducaoEtapa[]
  prazo_validade: number | null
  unidade_validade: UnidadeValidade | null
  condicao_armazenamento: ProducaoCondicaoArmazenamento | null
  temp_min: number | null
  temp_max: number | null
  tipo_recipiente: string | null
  qtd_recipientes: string | null
  validade_apos_aberto: string | null
  validade_apos_descongelamento: string | null
  instrucoes_etiqueta: string | null
  instrucoes_descarte: string | null
  qtd_lote_padrao: number | null
  unidade_rendimento: ProducaoRendimentoUnidade | null
  qtd_porcoes_unidades: number | null
  tempo_pre_preparo: string | null
  tempo_preparo: string | null
  tempo_descanso: string | null
  tempo_resfriamento: string | null
  tempo_total: string | null
  pode_ser_fracionada: boolean
  higienizacao: string | null
  epis: string | null
  cuidados_manipulacao: string | null
  padrao_esperado: string | null
  criterios_aprovacao: string | null
  acoes_corretivas: string | null
  alergenicos: string | null
  observacoes_gerais: string | null
  vinculos: ProducaoVinculo[]
  historico: FichaProducaoHistoricoEntry[]
  status: FichaStatus
  versao: number
  criado_por: string | null
  criado_em: string
  ultima_revisao_em: string | null
  publicado_por: string | null
  publicado_em: string | null
  created_at: string
  updated_at: string
}

export type FichaProducaoLoteRow = {
  id: string
  ficha_id: string
  numero_lote: string
  data_hora_producao: string
  responsavel: string
  quantidade_produzida: string
  data_hora_validade: string | null
  justificativa_alteracao: string | null
  observacao: string | null
  foto_url: string | null
  created_at: string
}

export type EstoqueCategoria = 'Bar' | 'Cozinha' | 'Salão' | 'Material de Limpeza' | 'Outros'
export type EstoqueUnidade = 'Caixa' | 'Unidade' | 'Quilo' | 'Litro' | 'Grama' | 'Mililitro' | 'Pacote' | 'Fardo'
export type MotivoRetirada = 'Produção' | 'Uso interno' | 'Perda' | 'Vencimento' | 'Quebra' | 'Transferência' | 'Outro'
export type EstoqueMovimentoTipo =
  | 'Entrada Manual'
  | 'Entrada por Produção'
  | 'Saída de Estoque'
  | 'Estorno de Retirada'
  | 'Ajuste de Estoque'
export type EstoqueTipoProduto = 'Matéria Prima' | 'Remanufaturado' | 'Pronto para Venda'
export type EstoqueCondicaoArmazenamento = 'Ambiente' | 'Refrigerado' | 'Congelado'

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
  tipo_produto: EstoqueTipoProduto
  marca: string | null
  volume_padrao: number | null
  condicao_armazenamento: EstoqueCondicaoArmazenamento | null
  prazo_validade: number | null
  unidade_validade: UnidadeValidade | null
  ficha_producao_id: string | null
  created_at: string
  updated_at: string
}

export type EstoqueMovimentoRow = {
  id: string
  // Null quando o produto de estoque original foi excluído (ver migration
  // 0030) — o movimento sobrevive como histórico, só perde o vínculo. Nome/
  // categoria/unidade continuam legíveis via os campos snapshot abaixo.
  item_id: string | null
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
  modulo: 'ficha_tecnica' | 'ficha_producao' | 'estoque' | 'pop'
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

export type SobreNosSecaoChave = 'historia' | 'time' | 'cargos'

export type SobreNosSecaoRow = {
  chave: SobreNosSecaoChave
  titulo: string
  conteudo_html: string
  atualizado_por: string | null
  atualizado_em: string
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
      mapa_blocks: TableDef<MapaBlockRow>
      pop_categories: TableDef<PopCategoryRow>
      pops: TableDef<PopRow>
      freelancers: TableDef<FreelancerRow>
      fichas_tecnicas: TableDef<FichaTecnicaRow>
      fichas_producao: TableDef<FichaProducaoRow>
      fichas_producao_lotes: TableDef<FichaProducaoLoteRow>
      estoque_itens: TableDef<EstoqueItemRow>
      estoque_movimentos: TableDef<EstoqueMovimentoRow>
      taxonomias: TableDef<TaxonomiaRow>
      mensagens: TableDef<MensagemRow>
      reservas: TableDef<ReservaRow>
      reserva_capacidade: TableDef<ReservaCapacidadeRow>
      freelancer_escalas: TableDef<FreelancerEscalaRow>
      sobre_nos_secoes: TableDef<SobreNosSecaoRow>
    }
    Views: {
      reservas_sem_contato: ViewDef<ReservaSemContatoRow>
      fichas_tecnicas_sem_custo: ViewDef<FichaTecnicaSemCustoRow>
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
      registrar_ajuste_estoque: {
        Args: { p_item_id: string; p_nova_quantidade: number; p_observacao?: string | null }
        Returns: EstoqueMovimentoRow
      }
      reservas_hoje_resumo: {
        Args: Record<string, never>
        Returns: { periodo: ReservaPeriodo; total_pessoas: number }[]
      }
      registrar_producao_checklist: {
        Args: { p_producao_id: string; p_quantidade: number; p_ingredientes: { estoqueItemId: string; quantidade: number }[] }
        Returns: { lote_id: string; movimento_id: string }[]
      }
      reverter_producao_checklist: {
        Args: { p_lote_id: string | null }
        Returns: undefined
      }
      checklist_agenda_todos_setores: {
        Args: Record<string, never>
        Returns: ChecklistAgendaRow[]
      }
      checklist_concluidas_em: {
        Args: { p_data: string }
        Returns: ChecklistConcluidaRow[]
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
