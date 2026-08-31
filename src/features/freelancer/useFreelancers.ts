import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { FreelancerEscalaRow, FreelancerRow } from '../../types/database'

export const FREELANCERS_KEY = ['freelancers']
export const FREELANCER_ESCALAS_KEY = ['freelancer_escalas']

// Módulo inteiro é Administrador-only (RLS: freelancers_admin_only /
// freelancer_escalas_admin_only) — não há visão parcial pra Gestor de setor.
export function useFreelancers() {
  return useQuery({
    queryKey: FREELANCERS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('freelancers').select('*').order('nome')
      if (error) throw error
      return data as FreelancerRow[]
    },
  })
}

export function useFreelancerEscalas() {
  return useQuery({
    queryKey: FREELANCER_ESCALAS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('freelancer_escalas').select('*').order('data', { ascending: false })
      if (error) throw error
      return data as FreelancerEscalaRow[]
    },
  })
}

// "Minha Escala" — usada só pelo perfil freelancer (RLS
// freelancer_escalas_select_own, migration 0036, já filtra pra só a própria
// escala; não precisa filtrar de novo no client). valor_pagamento vem junto
// na resposta — a tela que exibe é que decide não mostrar (pedido do
// usuário: freelancer não vê o próprio valor de pagamento).
export function useMinhaEscala() {
  return useQuery({
    queryKey: ['minha_escala'],
    queryFn: async () => {
      const { data, error } = await supabase.from('freelancer_escalas').select('*').order('data')
      if (error) throw error
      return data as FreelancerEscalaRow[]
    },
  })
}

export function useFreelancersRealtime() {
  const queryClient = useQueryClient()
  useEffect(() => {
    const channel = supabase
      .channel('freelancers:all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'freelancers' }, () => {
        queryClient.invalidateQueries({ queryKey: FREELANCERS_KEY })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'freelancer_escalas' }, () => {
        queryClient.invalidateQueries({ queryKey: FREELANCER_ESCALAS_KEY })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}
