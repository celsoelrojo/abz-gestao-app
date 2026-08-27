import { supabase } from '../../lib/supabaseClient'

// Path <setor>/<pop_id>/<arquivo> — RLS de pop-anexos (0020) usa o primeiro
// segmento pra decidir quem pode ler/escrever (Gestor do setor +
// Administrador; 'Geral' fica admin-only, igual à tabela pops).
export async function uploadPopAnexo(setor: string, popId: string, file: File): Promise<string> {
  const path = `${setor}/${popId}/${Date.now()}-${file.name}`
  const { error } = await supabase.storage.from('pop-anexos').upload(path, file)
  if (error) throw error
  return path
}

export async function popAnexoUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('pop-anexos').createSignedUrl(path, 300)
  if (error) throw error
  return data.signedUrl
}
