import type { SolicitacaoExclusaoRow } from '../../types/database'

// Nome de cada tabela que tem pedido de exclusão (as 15 do gatilho da migration 0052).
const TABELA_LABELS: Record<string, string> = {
  checklist_tasks: 'Tarefa do Checklist',
  cardapios: 'Cardápio RAF',
  mensagens: 'Mensagem',
  mapa_blocks: 'Bloco de Mapa',
  mapas_fluxogramas: 'Mapa ou Fluxograma',
  freelancer_escalas: 'Escala de Freelancer',
  pedidos_compra: 'Pedido de compra',
  taxonomias: 'Categoria do Estoque',
  estoque_itens: 'Produto do Estoque',
  fichas_producao: 'Ficha de Produção',
  pop_categories: "Categoria de POP",
  contas_pagar: 'Conta a pagar',
  pops: "POP",
  requisicoes: 'Requisição',
  fichas_tecnicas: 'Ficha Técnica',
  notificacao_destinos: 'Destino de notificação',
}

export function rotuloTabela(tabela: string): string {
  return TABELA_LABELS[tabela] ?? tabela
}

// Anexo guardado no storage por registro: o banco apaga a linha, mas arquivo
// não — quem aprova remove o anexo em seguida, senão ele ficaria órfão.
const ANEXOS: Record<string, { bucket: string; coluna: string }[]> = {
  contas_pagar: [{ bucket: 'notas-fiscais', coluna: 'nota_foto_path' }],
  requisicoes: [{ bucket: 'requisicoes-fotos', coluna: 'foto_path' }],
  pedidos_compra: [{ bucket: 'pedidos-espelhos', coluna: 'espelho_url' }],
  mapa_blocks: [{ bucket: 'mapas-imagens', coluna: 'image_url' }],
}

export function anexosDoRegistro(tabela: string, dados: Record<string, unknown>): { bucket: string; path: string }[] {
  return (ANEXOS[tabela] ?? [])
    .map(({ bucket, coluna }) => ({ bucket, path: dados[coluna] }))
    .filter((a): a is { bucket: string; path: string } => typeof a.path === 'string' && a.path !== '' && !/^https?:/i.test(a.path))
}

const CAMPOS_OCULTOS = new Set(['id', 'created_at', 'updated_at', 'criado_em', 'atualizado_em', 'criado_por', 'recebido_por'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Os campos "simples" do registro (texto, número, sim/não) pra quem decide ver
// o que seria apagado; listas e objetos aninhados ficam de fora.
export function resumirDados(dados: Record<string, unknown>, max = 10): { campo: string; valor: string }[] {
  return Object.entries(dados)
    .filter(([k, v]) => !CAMPOS_OCULTOS.has(k) && !k.endsWith('_id') && v != null && v !== '' && typeof v !== 'object' && !(typeof v === 'string' && UUID.test(v)))
    .slice(0, max)
    .map(([k, v]) => ({
      campo: k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()),
      valor: typeof v === 'boolean' ? (v ? 'Sim' : 'Não') : String(v).slice(0, 160),
    }))
}

export function pedidosPendentes(lista: Pick<SolicitacaoExclusaoRow, 'status'>[]): number {
  return lista.filter((s) => s.status === 'pendente').length
}

export const STATUS_PEDIDO_LABEL: Record<SolicitacaoExclusaoRow['status'], string> = {
  pendente: 'Aguardando o Administrador',
  aprovada: 'Aprovada — apagado',
  recusada: 'Recusada — mantido',
}
