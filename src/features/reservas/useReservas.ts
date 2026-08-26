import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { isManager, useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabaseClient'
import type { ReservaCapacidadeRow, ReservaRow, ReservaSemContatoRow } from '../../types/database'

export const RESERVAS_KEY = ['reservas']
export const RESERVA_CAPACIDADE_KEY = ['reserva_capacidade']

// Administrador e Gestor de Salão leem a tabela cheia (telefone/instagram/
// email inclusos); Atendente (perfil 'salao' comum) lê a view
// reservas_sem_contato — mesma convenção já usada em fichas_tecnicas para
// esconder custo: a RLS permite os dois lerem a tabela base, então a
// diferença é uma escolha do app, não uma garantia do banco. Normaliza pro
// mesmo shape (campos de contato como null pra quem usa a view) pra não
// precisar de dois tipos diferentes na tela.
export function useReservas() {
  const profile = useAuthStore((s) => s.profile)
  const canSeeContato = isManager(profile, undefined)

  return useQuery({
    queryKey: [...RESERVAS_KEY, canSeeContato],
    queryFn: async (): Promise<ReservaRow[]> => {
      if (canSeeContato) {
        const { data, error } = await supabase.from('reservas').select('*').order('data').order('horario')
        if (error) throw error
        return data as ReservaRow[]
      }
      const { data, error } = await supabase.from('reservas_sem_contato').select('*').order('data').order('horario')
      if (error) throw error
      return (data as ReservaSemContatoRow[]).map((r) => ({ ...r, telefone: null, email: null, instagram: null }))
    },
  })
}

export function useReservasRealtime() {
  const queryClient = useQueryClient()
  useEffect(() => {
    const channel = supabase
      .channel('reservas:all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, () => {
        queryClient.invalidateQueries({ queryKey: RESERVAS_KEY, exact: false })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}

export function useReservaCapacidade() {
  return useQuery({
    queryKey: RESERVA_CAPACIDADE_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('reserva_capacidade').select('*')
      if (error) throw error
      return data as ReservaCapacidadeRow[]
    },
  })
}
