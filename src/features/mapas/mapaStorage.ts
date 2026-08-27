import { supabase } from '../../lib/supabaseClient'

// Bucket privado (RLS por setor, só quem gerencia escreve) — mesmo padrão de
// fichaStorage.ts: signed URL pra exibir, getPublicUrl não funciona aqui.
export async function uploadMapaImagem(setor: string, file: File): Promise<string> {
  const path = `${setor}/${Date.now()}-${file.name}`
  const { error } = await supabase.storage.from('mapas-imagens').upload(path, file)
  if (error) throw error
  return path
}

export async function mapaImagemUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('mapas-imagens').createSignedUrl(path, 300)
  if (error) throw error
  return data.signedUrl
}
