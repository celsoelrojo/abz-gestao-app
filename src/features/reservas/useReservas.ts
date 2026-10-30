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
      return (data as ReservaSemContatoRow[]).map((r) => ({
        ...r,
        telefone: null,
        email: null,
        instagram: null,
        cliente_id: null,
        acompanhamento_obs: null,
      }))
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

export interface ClienteEncontrado {
  nome: string
  reservasAnteriores: number
}

// Procura o cliente pelo WhatsApp (já normalizado) no banco de clientes —
// usado no formulário de reserva pra reconhecer quem já veio. Só Admin/Gestão
// do Salão leem `clientes` (RLS), e só eles abrem o formulário. Conta as
// reservas anteriores do cliente (menos a que está sendo editada) pra decidir
// o "primeira vez na casa".
export async function buscarClientePorWhatsapp(
  whatsapp: string,
  ignorarReservaId?: string,
): Promise<ClienteEncontrado | null> {
  const { data: cliente, error } = await supabase
    .from('clientes')
    .select('id, nome')
    .eq('whatsapp', whatsapp)
    .maybeSingle()
  if (error) throw error
  if (!cliente) return null
  let query = supabase.from('reservas').select('id', { count: 'exact', head: true }).eq('cliente_id', cliente.id)
  if (ignorarReservaId) query = query.neq('id', ignorarReservaId)
  const { count, error: countError } = await query
  if (countError) throw countError
  return { nome: cliente.nome, reservasAnteriores: count ?? 0 }
}
