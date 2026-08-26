import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { isoDate } from '../../lib/date'
import type { MensagemRow } from '../../types/database'

export const MENSAGENS_KEY = ['mensagens']

// RLS já resolve a visibilidade (Administrador vê tudo; os demais só
// 'Todos' + a própria setor) — o client só pede tudo que voltar.
export function useMensagens() {
  return useQuery({
    queryKey: MENSAGENS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('mensagens').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return data as MensagemRow[]
    },
  })
}

export function useMensagensRealtime() {
  const queryClient = useQueryClient()
  useEffect(() => {
    const channel = supabase
      .channel('mensagens:all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mensagens' }, () => {
        queryClient.invalidateQueries({ queryKey: MENSAGENS_KEY })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}

// Resumo agregado (sem expor linha nenhuma de reserva) — visível a
// qualquer perfil autenticado, mesmo quem não tem acesso ao módulo Reservas.
export function useReservasResumoHoje() {
  return useQuery({
    queryKey: ['reservas_hoje_resumo'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('reservas_hoje_resumo')
      if (error) throw error
      const almoco = data.find((d) => d.periodo === 'Almoço')?.total_pessoas ?? 0
      const noite = data.find((d) => d.periodo === 'Noite')?.total_pessoas ?? 0
      return { almoco: Number(almoco), noite: Number(noite) }
    },
  })
}

// Só Cozinha/Gestor de Cozinha (RLS de freelancer_escalas só libera leitura
// pra esses dois papéis, e só de linhas do próprio setor) — `enabled`
// evita a query pra quem nunca vai poder usá-la mesmo.
export function useFreelancersResumoHoje(enabled: boolean) {
  return useQuery({
    queryKey: ['freelancers_hoje_resumo'],
    enabled,
    queryFn: async () => {
      const hoje = isoDate(new Date())
      const { data, error } = await supabase
        .from('freelancer_escalas')
        .select('periodo')
        .eq('data', hoje)
        .eq('setor', 'Cozinha')
      if (error) throw error
      return {
        almoco: data.filter((d) => d.periodo === 'Almoço').length,
        noite: data.filter((d) => d.periodo === 'Noite').length,
      }
    },
  })
}
