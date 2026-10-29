import { formatWeekdayLong, isoDate, weekdayNameForDate } from '../../lib/date'
import type { CardapioDia } from '../../types/database'

function paraData(iso: string): Date {
  // Meia-noite LOCAL — new Date('YYYY-MM-DD') seria UTC e pode cair no dia
  // anterior no fuso do Brasil.
  return new Date(`${iso}T00:00:00`)
}

function somarDias(date: Date, dias: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + dias)
  return d
}

// Segunda-feira da semana (Segunda–Domingo, igual ao Checklist) que contém a
// data. Domingo pertence à semana que termina nele.
export function segundaDaSemana(iso: string): string {
  const d = paraData(iso)
  const offset = d.getDay() === 0 ? -6 : 1 - d.getDay()
  return isoDate(somarDias(d, offset))
}

// Segunda-feira da PRÓXIMA semana — padrão ao montar um cardápio novo, já que
// o cardápio costuma ser planejado antes da semana começar.
export function proximaSegunda(hoje: Date): string {
  return isoDate(somarDias(paraData(segundaDaSemana(isoDate(hoje))), 7))
}

export interface DiaDaSemana {
  indice: number // 0 = segunda … 6 = domingo
  iso: string
  rotulo: string // "Segunda-feira, 3 de novembro"
}

export function diasDaSemana(segundaIso: string): DiaDaSemana[] {
  const segunda = paraData(segundaIso)
  return Array.from({ length: 7 }, (_, indice) => {
    const d = somarDias(segunda, indice)
    return { indice, iso: isoDate(d), rotulo: formatWeekdayLong(d, weekdayNameForDate(d)) }
  })
}

function ddmm(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export function tituloSemana(segundaIso: string): string {
  const domingo = isoDate(somarDias(paraData(segundaIso), 6))
  return `Semana de ${ddmm(segundaIso)} a ${ddmm(domingo)}`
}

export function semanaContem(segundaIso: string, hoje: Date): boolean {
  return segundaDaSemana(isoDate(hoje)) === segundaIso
}

// Prato (id da ficha) escolhido em cada um dos 7 dias — '' quando o dia não
// tem prato. Usa a posição na semana, não a data, pra a escolha sobreviver à
// troca da semana no formulário.
export function pratosPorIndice(segundaIso: string, dias: CardapioDia[]): string[] {
  const porData = new Map(dias.map((d) => [d.data, d.fichaTecnicaId]))
  return diasDaSemana(segundaIso).map((dia) => porData.get(dia.iso) ?? '')
}
