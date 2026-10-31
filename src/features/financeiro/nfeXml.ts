import { sanearNota, type NotaLida } from './notaHelpers'

// Importação do XML de uma NF-e/NFC-e (o arquivo que o fornecedor manda por
// e-mail). Dados exatos, sem IA: o resultado é o mesmo tipo `NotaLida` da leitura
// por foto, então a tela de conferência e o lançamento são os mesmos.

// Os elementos do XML vivem num namespace (portalfiscal.inf.br/nfe); o jeito
// robusto de achar é pelo nome local, em qualquer namespace.
function filhos(pai: Element | Document, nome: string): Element[] {
  return Array.from(pai.getElementsByTagNameNS('*', nome))
}
function primeiro(pai: Element | Document | undefined | null, nome: string): Element | null {
  return pai ? (filhos(pai, nome)[0] ?? null) : null
}
function valor(pai: Element | Document | undefined | null, nome: string): string {
  return primeiro(pai, nome)?.textContent?.trim() ?? ''
}

// tPag da NF-e -> texto que a tela entende.
const FORMA_PAGAMENTO: Record<string, string> = {
  '01': 'Dinheiro',
  '02': 'Cheque',
  '03': 'Cartão de crédito',
  '04': 'Cartão de débito',
  '15': 'Boleto',
  '17': 'Pix',
}

// dhEmi/dEmi vêm como "2026-10-30T14:05:00-03:00" ou "2026-10-30": só a data.
const soData = (s: string) => s.slice(0, 10)

export function lerXmlNfe(xml: string): NotaLida {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length > 0) throw new Error('O arquivo não é um XML válido.')

  const inf = primeiro(doc, 'infNFe')
  if (!inf) throw new Error('Este XML não é de uma nota fiscal eletrônica (NF-e / NFC-e).')

  const ide = primeiro(inf, 'ide')
  const emit = primeiro(inf, 'emit')
  const tot = primeiro(primeiro(inf, 'total'), 'ICMSTot')

  // A chave está no atributo Id ("NFe" + 44 dígitos) e, quando há protocolo, em chNFe.
  const chave = (inf.getAttribute('Id') ?? '').replace(/\D/g, '') || valor(doc, 'chNFe')

  const itens = filhos(inf, 'det').map((det) => {
    const prod = primeiro(det, 'prod')
    const bruto = Number(valor(prod, 'vProd')) || 0
    const desconto = Number(valor(prod, 'vDesc')) || 0
    return {
      descricao: valor(prod, 'xProd'),
      quantidade: Number(valor(prod, 'qCom')) || 0,
      unidade: valor(prod, 'uCom'),
      valor_unitario: Number(valor(prod, 'vUnCom')) || 0,
      valor_total: Math.max(0, bruto - desconto),
    }
  })

  // Duplicatas (cobrança): vencimento de cada parcela. A conta usa a primeira;
  // as demais vão para as observações pra ninguém perder a informação.
  const duplicatas = filhos(inf, 'dup')
    .map((d) => ({ venc: soData(valor(d, 'dVenc')), valor: Number(valor(d, 'vDup')) || 0 }))
    .filter((d) => d.venc)
    .sort((a, b) => a.venc.localeCompare(b.venc))
  const detPag = primeiro(primeiro(inf, 'pag'), 'detPag')
  const obsDup =
    duplicatas.length > 1
      ? `Nota parcelada em ${duplicatas.length} duplicatas: ` +
        duplicatas.map((d) => `${d.venc.split('-').reverse().join('/')} – R$ ${d.valor.toFixed(2).replace('.', ',')}`).join('; ') +
        '. Esta conta usa o valor total e a primeira data.'
      : ''

  return sanearNota({
    legivel: true,
    fornecedor: valor(emit, 'xNome') || valor(emit, 'xFant'),
    cnpj: valor(emit, 'CNPJ'),
    numero_nota: valor(ide, 'nNF'),
    chave_acesso: chave,
    data_emissao: soData(valor(ide, 'dhEmi') || valor(ide, 'dEmi')),
    vencimento: duplicatas[0]?.venc ?? '',
    valor_total: Number(valor(tot, 'vNF')) || 0,
    forma_pagamento: FORMA_PAGAMENTO[valor(detPag, 'tPag')] ?? '',
    itens,
    observacoes: obsDup,
  })
}
