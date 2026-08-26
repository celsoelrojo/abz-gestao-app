import { describe, expect, it } from 'vitest'
import { TsplAdapter } from './TsplAdapter'
import type { EtiquetaProducaoData, PrinterConfig } from './types'

const config: PrinterConfig = {
  id: '1',
  nome: 'Impressora teste',
  modelo: 'Modelo X',
  conexao: 'Bluetooth',
  linguagem: 'TSPL',
  larguraMm: 50,
  alturaMm: 30,
  espacamentoMm: 2,
  densidade: 8,
  velocidade: 4,
  protocoloConfirmado: true,
}

const etiqueta: EtiquetaProducaoData = {
  produto: 'Gelo saborizado',
  preparo: '24/08/2026 15:04',
  validade: '23/09/2026 15:04',
  armazenar: 'Congelado',
  responsavel: 'Fernanda Costa',
  quantidade: '4,6 Litro',
}

function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}

describe('TsplAdapter', () => {
  it('gera o cabeçalho SIZE/GAP com as dimensões configuradas', () => {
    const out = decode(new TsplAdapter().buildJob(etiqueta, 1, config))
    expect(out).toContain('SIZE 50 mm, 30 mm')
    expect(out).toContain('GAP 2 mm, 0 mm')
  })

  it('inclui densidade e velocidade só quando configuradas', () => {
    const out = decode(new TsplAdapter().buildJob(etiqueta, 1, config))
    expect(out).toContain('DENSITY 8')
    expect(out).toContain('SPEED 4')

    const semConfig = { ...config, densidade: null, velocidade: null }
    const out2 = decode(new TsplAdapter().buildJob(etiqueta, 1, semConfig))
    expect(out2).not.toContain('DENSITY')
    expect(out2).not.toContain('SPEED')
  })

  it('inclui os 6 campos da etiqueta como comandos TEXT', () => {
    const out = decode(new TsplAdapter().buildJob(etiqueta, 1, config))
    expect(out).toContain('Produto: Gelo saborizado')
    expect(out).toContain('Preparo: 24/08/2026 15:04')
    expect(out).toContain('Validade: 23/09/2026 15:04')
    expect(out).toContain('Armazenar: Congelado')
    expect(out).toContain('Responsável: Fernanda Costa')
    expect(out).toContain('Quantidade: 4,6 Litro')
  })

  it('PRINT usa a quantidade de cópias solicitada', () => {
    const out = decode(new TsplAdapter().buildJob(etiqueta, 3, config))
    expect(out).toContain('PRINT 1,3')
  })

  it('escapa aspas e barras invertidas no texto (evita quebrar o comando TSPL)', () => {
    const out = decode(
      new TsplAdapter().buildJob({ ...etiqueta, produto: 'Vodka "Premium" 1L' }, 1, config),
    )
    expect(out).toContain('Produto: Vodka \\"Premium\\" 1L')
  })
})
