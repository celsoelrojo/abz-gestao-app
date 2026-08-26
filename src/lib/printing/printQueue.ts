import { Capacitor } from '@capacitor/core'
import { supabase } from '../supabaseClient'
import { TsplAdapter } from './TsplAdapter'
import type { EtiquetaProducaoData, PrinterAdapter, PrinterConfig } from './types'

const ADAPTERS: Record<PrinterConfig['linguagem'], PrinterAdapter> = {
  TSPL: new TsplAdapter(),
  // ZPL/Outro entram aqui quando tiverem adaptador implementado.
  ZPL: new TsplAdapter(),
  Outro: new TsplAdapter(),
}

// Enfileira o job no banco (histórico + status) e — só se estiver rodando
// como app nativo (Capacitor) — tenta enviar de verdade pela impressora.
// No navegador, nunca promete Bluetooth direto: fica "Pendente" pra
// impressão via SO/fila, exatamente como pedido.
export async function enqueuePrintJob(params: {
  printer: PrinterConfig
  lote_id: string | null
  quantidade_etiquetas: number
  data: EtiquetaProducaoData
  responsavel_id: string
  responsavel_nome: string
}) {
  const { data: job, error } = await supabase
    .from('print_jobs')
    .insert({
      printer_id: params.printer.id,
      lote_id: params.lote_id,
      quantidade_etiquetas: params.quantidade_etiquetas,
      conteudo: params.data,
      responsavel_id: params.responsavel_id,
      responsavel_nome: params.responsavel_nome,
      status: 'Pendente',
    })
    .select()
    .single()
  if (error) throw error

  if (Capacitor.isNativePlatform() && params.printer.protocoloConfirmado) {
    await processPrintJob(job.id, params.printer, params.data, params.quantidade_etiquetas)
  }

  return job
}

// Processa um job pendente: gera os comandos com o adaptador certo e tenta
// mandar pelo transporte (Bluetooth/USB/Rede) — implementação do transporte
// fica no app nativo (ver src/lib/printing/transports quando o plugin
// Bluetooth for escolhido, depois de confirmar o modelo real da impressora).
export async function processPrintJob(
  jobId: string,
  printer: PrinterConfig,
  data: EtiquetaProducaoData,
  quantidade: number,
) {
  await supabase.from('print_jobs').update({ status: 'Enviando' }).eq('id', jobId)
  try {
    const adapter = ADAPTERS[printer.linguagem]
    adapter.buildJob(data, quantidade, printer)
    // TODO: transport.connect(printer) + transport.write(bytes) — plugin
    // concreto depende do protocolo confirmado do modelo (ver README).
    throw new Error('Transporte de impressão ainda não implementado para este ambiente.')
  } catch (err) {
    await supabase
      .from('print_jobs')
      .update({ status: 'Falhou', erro: err instanceof Error ? err.message : String(err) })
      .eq('id', jobId)
    throw err
  }
}

export async function reprintJob(jobId: string) {
  await supabase.from('print_jobs').update({ status: 'Reimprimir', tentativas: 0, erro: null }).eq('id', jobId)
}
