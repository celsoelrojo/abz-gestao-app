import { describe, expect, it } from 'vitest'
import { lerXmlNfe } from './nfeXml'

const CHAVE = '28261012345678000190550010000012341000012349'

// NF-e mínima, com os mesmos elementos/namespace de uma nota real.
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe${CHAVE}" versao="4.00">
      <ide><nNF>1234</nNF><dhEmi>2026-10-28T10:30:00-03:00</dhEmi></ide>
      <emit><CNPJ>12345678000190</CNPJ><xNome>Distribuidora Sergipana LTDA</xNome></emit>
      <det nItem="1"><prod>
        <cProd>001</cProd><xProd>CERVEJA HEINEKEN 600ML</xProd><uCom>CX</uCom>
        <qCom>10.0000</qCom><vUnCom>120.0000000000</vUnCom><vProd>1200.00</vProd><vDesc>50.00</vDesc>
      </prod></det>
      <det nItem="2"><prod>
        <cProd>002</cProd><xProd>AGUA SEM GAS 500ML</xProd><uCom>FD</uCom>
        <qCom>5.0000</qCom><vUnCom>18.5000000000</vUnCom><vProd>92.50</vProd>
      </prod></det>
      <total><ICMSTot><vProd>1292.50</vProd><vNF>1242.50</vNF></ICMSTot></total>
      <cobr>
        <dup><nDup>001</nDup><dVenc>2026-11-27</dVenc><vDup>621.25</vDup></dup>
        <dup><nDup>002</nDup><dVenc>2026-11-12</dVenc><vDup>621.25</vDup></dup>
      </cobr>
      <pag><detPag><tPag>15</tPag><vPag>1242.50</vPag></detPag></pag>
    </infNFe>
  </NFe>
  <protNFe><infProt><chNFe>${CHAVE}</chNFe></infProt></protNFe>
</nfeProc>`

describe('lerXmlNfe', () => {
  const nota = lerXmlNfe(XML)

  it('lê o cabeçalho', () => {
    expect(nota.legivel).toBe(true)
    expect(nota.fornecedor).toBe('Distribuidora Sergipana LTDA')
    expect(nota.cnpj).toBe('12345678000190')
    expect(nota.numero_nota).toBe('1234')
    expect(nota.chave_acesso).toBe(CHAVE)
    expect(nota.data_emissao).toBe('2026-10-28')
    expect(nota.valor_total).toBe(1242.5)
    expect(nota.forma_pagamento).toBe('Boleto')
  })

  it('lê os itens, descontando o desconto do item', () => {
    expect(nota.itens).toHaveLength(2)
    expect(nota.itens[0]).toMatchObject({ descricao: 'CERVEJA HEINEKEN 600ML', unidade: 'CX', quantidade: 10, valor_unitario: 120, valor_total: 1150 })
    expect(nota.itens[1].valor_total).toBe(92.5)
  })

  it('usa a primeira duplicata como vencimento e avisa das demais', () => {
    expect(nota.vencimento).toBe('2026-11-12')
    expect(nota.observacoes).toContain('2 duplicatas')
  })

  it('recusa arquivo que não é XML ou não é nota fiscal', () => {
    expect(() => lerXmlNfe('isto não é xml <<<')).toThrow()
    expect(() => lerXmlNfe('<?xml version="1.0"?><outra><coisa/></outra>')).toThrow('não é de uma nota fiscal')
  })
})
