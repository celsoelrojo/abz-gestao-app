import { formatValidadeRotulo, validadeInfo } from '../estoque/estoqueHelpers'

// Espelha reservasHojeResumoTexto() do protótipo (script.js:2970-2979) —
// visível pra qualquer perfil (não só quem gerencia Reservas), por isso vem
// de um RPC agregado (reservas_hoje_resumo) em vez de ler a tabela direto.
export function reservasResumoTexto(almoco: number, noite: number): string | null {
  if (!almoco && !noite) return null
  const pessoas = (n: number) => `${n} ${n === 1 ? 'pessoa reservada' : 'pessoas reservadas'}`
  if (almoco && noite) return `Hoje teremos ${pessoas(almoco)} para o almoço e ${noite} para a noite conosco.`
  if (almoco) return `Hoje teremos ${pessoas(almoco)} para o almoço conosco.`
  return `Hoje teremos ${pessoas(noite)} para a noite conosco.`
}

// Espelha freelancersHojeResumoCozinha() (script.js:6243-6252) — só
// Cozinha/Gestor de Cozinha veem (checado pelo chamador, não aqui).
export function freelancersResumoTexto(almoco: number, noite: number): string | null {
  if (!almoco && !noite) return null
  return `Freelancers no Almoço: ${almoco}. Freelancers na Noite: ${noite}.`
}

// Espelha estoqueCriticoAlertaTexto() (script.js:2984-2997).
export function estoqueCriticoTexto(titulos: string[]): string | null {
  if (!titulos.length) return null
  return titulos.length === 1
    ? `Estoque crítico: "${titulos[0]}" atingiu o estoque mínimo.`
    : `Estoque crítico: ${titulos.length} itens atingiram o estoque mínimo (${titulos.join(', ')}).`
}

// Espelha estoqueValidadeAlertaTexto() (script.js:3004-3023), reaproveitando
// o cálculo de dias/rótulo já existente no módulo Estoque.
export function estoqueValidadeTexto(itens: { title: string; validade: string }[], hojeIso: string): string | null {
  if (!itens.length) return null
  const comRotulo = itens.map((it) => ({ title: it.title, rotulo: formatValidadeRotulo(validadeInfo(it.validade, hojeIso)) }))
  if (comRotulo.length === 1) return `Validade próxima: "${comRotulo[0].title}" ${comRotulo[0].rotulo}.`
  const detalhes = comRotulo.map((it) => `${it.title} (${it.rotulo})`).join(', ')
  return `Validade próxima: ${comRotulo.length} itens perto do vencimento — ${detalhes}.`
}
