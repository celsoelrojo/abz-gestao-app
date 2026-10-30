import { describe, expect, it } from 'vitest'
import { formatarWhatsapp, normalizarWhatsapp } from './whatsapp'

describe('normalizarWhatsapp', () => {
  it('tira máscara e espaços', () => {
    expect(normalizarWhatsapp('(79) 98149-5581')).toBe('79981495581')
    expect(normalizarWhatsapp('79 9 8149 5581')).toBe('79981495581')
  })
  it('tira o 55 do Brasil, então formatos diferentes dão a mesma chave', () => {
    expect(normalizarWhatsapp('+55 79 98149-5581')).toBe('79981495581')
    expect(normalizarWhatsapp('5579981495581')).toBe('79981495581')
    expect(normalizarWhatsapp('5579981495581')).toBe(normalizarWhatsapp('(79) 98149-5581'))
  })
  it('não confunde DDD 55 (RS) com código do país', () => {
    expect(normalizarWhatsapp('55 99999-8888')).toBe('55999998888') // 11 dígitos: DDD 55
    expect(normalizarWhatsapp('55 3333-4444')).toBe('5533334444') // 10 dígitos: DDD 55
  })
  it('curto demais ou longo demais é inválido', () => {
    expect(normalizarWhatsapp('')).toBeNull()
    expect(normalizarWhatsapp('98149-5581')).toBeNull() // sem DDD (9 dígitos)
    expect(normalizarWhatsapp('1234567890123456')).toBeNull()
  })
})

describe('formatarWhatsapp', () => {
  it('formata celular e fixo brasileiros', () => {
    expect(formatarWhatsapp('79981495581')).toBe('(79) 98149-5581')
    expect(formatarWhatsapp('7932145581')).toBe('(79) 3214-5581')
  })
  it('deixa outros formatos e vazio como estão', () => {
    expect(formatarWhatsapp(null)).toBe('')
    expect(formatarWhatsapp('13055501234')).toBe('(13) 05550-1234') // 11 dígitos formata igual
    expect(formatarWhatsapp('texto livre')).toBe('texto livre')
  })
})
