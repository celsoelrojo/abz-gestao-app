// Toggle simples: some da lista se já estava, entra se não estava.
export function toggleValue<T>(current: T[], value: T): T[] {
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
}

// Mesma regra do protótipo (toggleSemanaDoMes): Mensal permite só 1 semana
// selecionada, Quinzenal permite 2 — ao estourar o limite, a mais antiga sai
// (FIFO) pra dar lugar à nova escolha, em vez de simplesmente recusar o clique.
export function toggleSemanaDoMes(current: string[], value: string, max: number): string[] {
  if (current.includes(value)) return current.filter((v) => v !== value)
  const next = [...current, value]
  return next.length > max ? next.slice(next.length - max) : next
}
