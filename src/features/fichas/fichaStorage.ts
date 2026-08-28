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

// "Excluir foto principal" (pedido do usuário, Identificação da Ficha de
// Produção) — apaga o arquivo do bucket também, não só a referência na
// ficha; sem isso o storage acumula imagem órfã pra sempre.
export async function deleteFichaImagem(path: string): Promise<void> {
  const { error } = await supabase.storage.from('fichas-imagens').remove([path])
  if (error) throw error
}
