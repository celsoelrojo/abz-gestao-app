import { isFullAdmin } from '../../store/authStore'
import type { EstoqueCategoria, ProfileRow } from '../../types/database'
import { ESTOQUE_CATEGORIAS } from './estoqueConstants'

// Administrador enxerga as 5 categorias (incluindo as transversais Material
// de Limpeza/Outros, que nunca batem com o setor de ninguém); qualquer outro
// perfil só a própria — mesma regra que a RLS já aplica no banco (esta
// função é só pra montar a UI, a permissão de verdade é sempre a RLS).
export function visibleCategorias(profile: ProfileRow | null): EstoqueCategoria[] {
  if (isFullAdmin(profile)) return ESTOQUE_CATEGORIAS
  return profile?.setor ? [profile.setor] : []
}
