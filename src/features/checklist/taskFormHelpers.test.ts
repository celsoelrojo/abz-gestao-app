import { describe, expect, it } from 'vitest'
import { toggleSemanaDoMes, toggleValue } from './taskFormHelpers'

describe('toggleValue', () => {
  it('adiciona o valor se não estava presente', () => {
    expect(toggleValue(['Segunda'], 'Terça')).toEqual(['Segunda', 'Terça'])
  })

  it('remove o valor se já estava presente', () => {
    expect(toggleValue(['Segunda', 'Terça'], 'Segunda')).toEqual(['Terça'])
  })
})

describe('toggleSemanaDoMes', () => {
  it('adiciona livremente enquanto não estoura o máximo', () => {
    expect(toggleSemanaDoMes([], '1', 2)).toEqual(['1'])
    expect(toggleSemanaDoMes(['1'], '3', 2)).toEqual(['1', '3'])
  })

  it('remove se já estava selecionada', () => {
    expect(toggleSemanaDoMes(['1', '3'], '1', 2)).toEqual(['3'])
  })

  it('Mensal (max=1): escolher uma nova substitui a anterior', () => {
    expect(toggleSemanaDoMes(['1'], '2', 1)).toEqual(['2'])
  })

  it('Quinzenal (max=2): a 3ª escolha expulsa a mais antiga (FIFO)', () => {
    expect(toggleSemanaDoMes(['1', '3'], '5', 2)).toEqual(['3', '5'])
  })
})
