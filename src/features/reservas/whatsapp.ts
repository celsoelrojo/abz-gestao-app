// WhatsApp do cliente = identificador das reservas e do banco de clientes.
// Espelha public.normalizar_whatsapp (migration 0047) — o banco é quem decide
// a chave de verdade; isto só deixa a tela fazer a mesma conta (buscar o
// cliente antes de salvar, validar o campo).

// Só dígitos, sem o 55 do Brasil (12–13 dígitos começando com 55 viram
// 10–11). Menos de 10 ou mais de 15 dígitos = inválido (null).
export function normalizarWhatsapp(texto: string): string | null {
  const d = texto.replace(/[^0-9]/g, '')
  if (/^55[0-9]{10,11}$/.test(d)) return d.slice(2)
  return d.length >= 10 && d.length <= 15 ? d : null
}

// "79981495581" -> "(79) 98149-5581"; fixo de 10 dígitos -> "(79) 3214-5581".
// Número de outro formato (estrangeiro) volta como está.
export function formatarWhatsapp(valor: string | null): string {
  if (!valor) return ''
  const d = valor.replace(/[^0-9]/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return valor
}
