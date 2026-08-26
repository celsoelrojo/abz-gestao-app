// Arquitetura por adaptadores: PrinterAdapter conhece a LINGUAGEM da
// impressora (TSPL, ZPL, ...) e gera os comandos; PrinterTransport conhece o
// CANAL (Bluetooth Classic, BLE, USB, rede) e sabe mandar bytes. Os dois são
// desacoplados de propósito — o mesmo adaptador TSPL serve tanto pra uma
// impressora Bluetooth quanto pra uma de rede, só troca o transporte.

export interface EtiquetaProducaoData {
  produto: string
  preparo: string     // já formatado (ex.: "24/08/2026 15:04")
  validade: string
  armazenar: string
  responsavel: string
  quantidade: string   // já formatado com unidade (ex.: "4,6 Litro")
}

export interface PrinterConfig {
  id: string
  nome: string
  modelo: string
  conexao: 'Bluetooth' | 'USB' | 'Rede'
  endereco?: string | null
  linguagem: 'TSPL' | 'ZPL' | 'Outro'
  larguraMm: number
  alturaMm: number
  espacamentoMm: number
  densidade?: number | null
  velocidade?: number | null
  protocoloConfirmado: boolean
}

export interface PrinterAdapter {
  /** Gera os bytes/comandos pra imprimir `quantidade` cópias da etiqueta. */
  buildJob(data: EtiquetaProducaoData, quantidade: number, config: PrinterConfig): Uint8Array
}

export interface PrinterTransport {
  connect(config: PrinterConfig): Promise<void>
  write(bytes: Uint8Array): Promise<void>
  disconnect(): Promise<void>
}
