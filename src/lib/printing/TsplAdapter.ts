import type { EtiquetaProducaoData, PrinterAdapter, PrinterConfig } from './types'

// Adaptador TSPL pra etiqueta de produção 50x30mm (mesmo layout/campos da
// etiqueta HTML do protótipo: Produto/Preparo/Validade/Armazenar/
// Responsável/Quantidade). Coordenadas em "dots" — a maioria das impressoras
// TSPL de etiqueta usa 8 dots/mm (203dpi); ajustável se o modelo real usar
// outra resolução.
const DOTS_PER_MM = 8

function escapeTspl(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export class TsplAdapter implements PrinterAdapter {
  buildJob(data: EtiquetaProducaoData, quantidade: number, config: PrinterConfig): Uint8Array {
    const linhas = [
      `Produto: ${data.produto}`,
      `Preparo: ${data.preparo}`,
      `Validade: ${data.validade}`,
      `Armazenar: ${data.armazenar}`,
      `Responsável: ${data.responsavel}`,
      `Quantidade: ${data.quantidade}`,
    ]

    const commands: string[] = []
    commands.push(`SIZE ${config.larguraMm} mm, ${config.alturaMm} mm`)
    commands.push(`GAP ${config.espacamentoMm} mm, 0 mm`)
    commands.push('DIRECTION 1')
    if (config.densidade) commands.push(`DENSITY ${config.densidade}`)
    if (config.velocidade) commands.push(`SPEED ${config.velocidade}`)
    commands.push('CLS')

    const margemDots = Math.round(2 * DOTS_PER_MM)
    const alturaLinhaDots = Math.round(((config.alturaMm * DOTS_PER_MM) - margemDots * 2) / linhas.length)
    linhas.forEach((linha, i) => {
      const y = margemDots + i * alturaLinhaDots
      commands.push(`TEXT ${margemDots},${y},"3",0,1,1,"${escapeTspl(linha)}"`)
    })

    commands.push(`PRINT 1,${quantidade}`)

    return new TextEncoder().encode(commands.join('\r\n') + '\r\n')
  }
}
