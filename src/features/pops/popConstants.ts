export const POP_SETORES = ['Bar', 'Cozinha', 'Salão', 'Geral'] as const
export type PopSetor = (typeof POP_SETORES)[number]

export const POP_STATUS_LABELS = {
  rascunho: 'Rascunho',
  publicada: 'Publicado',
  inativa: 'Inativo',
} as const
