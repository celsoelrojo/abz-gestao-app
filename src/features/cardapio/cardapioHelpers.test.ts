import { describe, expect, it } from 'vitest'
import { diasDaSemana, pratosPorIndice, proximaSegunda, segundaDaSemana, semanaContem, tituloSemana } from './cardapioHelpers'

describe('segundaDaSemana', () => {
  it('qualquer dia da semana volta pra segunda', () => {
    expect(segundaDaSemana('2026-11-02')).toBe('2026-11-02') // segunda
    expect(segundaDaSemana('2026-11-04')).toBe('2026-11-02') // quarta
    expect(segundaDaSemana('2026-11-08')).toBe('2026-11-02') // domingo fecha a semana
  })
  it('atravessa virada de mês e de ano', () => {
    expect(segundaDaSemana('2026-12-31')).toBe('2026-12-28')
    expect(segundaDaSemana('2027-01-01')).toBe('2026-12-28')
  })
})

describe('proximaSegunda', () => {
  it('é a segunda da semana seguinte, mesmo partindo de domingo', () => {
    expect(proximaSegunda(new Date(2026, 10, 4))).toBe('2026-11-09') // quarta
    expect(proximaSegunda(new Date(2026, 10, 8))).toBe('2026-11-09') // domingo
    expect(proximaSegunda(new Date(2026, 10, 2))).toBe('2026-11-09') // segunda
  })
})

describe('diasDaSemana / tituloSemana', () => {
  it('gera segunda a domingo', () => {
    const dias = diasDaSemana('2026-11-02')
    expect(dias.map((d) => d.iso)).toEqual([
      '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08',
    ])
    expect(dias[0].rotulo).toBe('Segunda-feira, 2 de novembro')
    expect(dias[6].rotulo).toBe('Domingo, 8 de novembro')
  })
  it('titula com o intervalo segunda–domingo', () => {
    expect(tituloSemana('2026-11-02')).toBe('Semana de 02/11 a 08/11')
    expect(tituloSemana('2026-12-28')).toBe('Semana de 28/12 a 03/01')
  })
})

describe('semanaContem', () => {
  it('reconhece a semana de hoje', () => {
    expect(semanaContem('2026-11-02', new Date(2026, 10, 6))).toBe(true)
    expect(semanaContem('2026-11-02', new Date(2026, 10, 9))).toBe(false)
  })
})

describe('pratosPorIndice', () => {
  it('posiciona cada prato no seu dia e deixa vazio os demais', () => {
    const r = pratosPorIndice('2026-11-02', [
      { data: '2026-11-04', fichaTecnicaId: 'f1', nome: 'Feijoada' },
      { data: '2026-11-08', fichaTecnicaId: 'f2', nome: 'Moqueca' },
    ])
    expect(r).toEqual(['', '', 'f1', '', '', '', 'f2'])
  })
})
