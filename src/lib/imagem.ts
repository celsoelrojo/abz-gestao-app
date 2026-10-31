// Celular tira foto de vários MB: reduz o lado maior pra ladoMax px e
// recodifica em JPEG antes de subir ou de mandar pra leitura. Requisição usa
// 1600px (basta pra ver o defeito); nota fiscal usa mais (texto miúdo).
export async function reduzirImagem(file: File, ladoMax = 1600, qualidade = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const escala = Math.min(1, ladoMax / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível processar a imagem.'))), 'image/jpeg', qualidade),
  )
}

export function blobParaBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'))
    reader.readAsDataURL(blob)
  })
}
