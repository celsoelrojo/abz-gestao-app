import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Falha alto e cedo — melhor um erro claro na tela do que queries
  // silenciosamente falhando por falta de credenciais.
  throw new Error(
    'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY não configuradas. Copie .env.example para .env.local e preencha com os dados do seu projeto Supabase.',
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
