import { supabase } from '../../lib/supabaseClient'

// Bucket privado (RLS por setor, só quem gerencia escreve) — precisa de
// signed URL pra exibir, getPublicUrl não funciona em bucket não-público.
export async function uploadFichaImagem(setor: string, file: File): Promise<string> {
  const path = `${setor}/${Date.now()}-${file.name}`
  const { error } = await supabase.storage.from('fichas-imagens').upload(path, file)
  if (error) throw error
  return path
}

export async function fichaImagemUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('fichas-imagens').createSignedUrl(path, 300)
  if (error) throw error
  return data.signedUrl
}
