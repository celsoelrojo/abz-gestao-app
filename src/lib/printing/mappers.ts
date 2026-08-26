import type { PrinterRow } from '../../types/database'
import type { PrinterConfig } from './types'

// PrinterConfig (usado pelos adaptadores) fica em camelCase de propósito —
// não quer saber de convenção de coluna do Postgres. Esta função é a única
// ponte entre as duas formas.
export function toPrinterConfig(row: PrinterRow): PrinterConfig {
  return {
    id: row.id,
    nome: row.nome,
    modelo: row.modelo,
    conexao: row.conexao,
    endereco: row.endereco,
    linguagem: row.linguagem,
    larguraMm: row.largura_mm,
    alturaMm: row.altura_mm,
    espacamentoMm: row.espacamento_mm,
    densidade: row.densidade,
    velocidade: row.velocidade,
    protocoloConfirmado: row.protocolo_confirmado,
  }
}
