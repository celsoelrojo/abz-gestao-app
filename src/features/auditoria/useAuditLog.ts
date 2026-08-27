import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import type { AuditLogRow } from '../../types/database'

type AuditAction = AuditLogRow['action']

export interface AuditLogFilters {
  tableName: string
  action: string
  actorNome: string
  dataInicio: string
  dataFim: string
}

// audit_log só cresce (sem tela pra apagar linhas) — diferente dos outros
// módulos, que buscam tudo e filtram no client, aqui os filtros vão pro
// servidor e o resultado fica limitado a 200 linhas por página de filtro.
export function useAuditLog(filters: AuditLogFilters) {
  return useQuery({
    queryKey: ['audit_log', filters],
    queryFn: async () => {
      let query = supabase.from('audit_log').select('*').order('changed_at', { ascending: false }).limit(200)
      if (filters.tableName) query = query.eq('table_name', filters.tableName)
      if (filters.action) query = query.eq('action', filters.action as AuditAction)
      if (filters.actorNome.trim()) query = query.ilike('actor_nome', `%${filters.actorNome.trim()}%`)
      if (filters.dataInicio) query = query.gte('changed_at', `${filters.dataInicio}T00:00:00`)
      if (filters.dataFim) query = query.lte('changed_at', `${filters.dataFim}T23:59:59`)
      const { data, error } = await query
      if (error) throw error
      return data as AuditLogRow[]
    },
  })
}
