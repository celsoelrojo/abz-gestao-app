// Nome amigável das tabelas auditadas (ver migration 0011_auditoria.sql —
// só essas 10 tabelas têm trigger de auditoria; o restante não é rastreado).
export const AUDIT_TABLE_LABELS: Record<string, string> = {
  checklist_tasks: 'Checklist — Tarefas',
  checklist_conclusoes: 'Checklist — Conclusões',
  estoque_itens: 'Estoque — Itens',
  estoque_movimentos: 'Estoque — Movimentos',
  reservas: 'Reservas',
  freelancer_escalas: 'Freelancer — Escalas',
  profiles: 'Contas',
  pops: "POP's",
  fichas_tecnicas: 'Fichas Técnicas',
  fichas_producao: 'Fichas de Produção',
}

export const AUDIT_TABLES = Object.keys(AUDIT_TABLE_LABELS)

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  INSERT: 'Criação',
  UPDATE: 'Alteração',
  DELETE: 'Exclusão',
}
