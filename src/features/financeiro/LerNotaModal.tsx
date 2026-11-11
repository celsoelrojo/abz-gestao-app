import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { confirmar } from '../../store/confirmStore'
import { diaOperacional, isoDate } from '../../lib/date'
import { useEstoqueItens, ESTOQUE_ITENS_KEY, ESTOQUE_MOVIMENTOS_KEY } from '../estoque/useEstoque'
import { useQueryClient } from '@tanstack/react-query'
import { CONTA_CATEGORIAS, FORMAS_PAGAMENTO } from './financeiroConstants'
import { lerXmlNfe } from './nfeXml'
import { formatBRL, parseValorBR } from './contaHelpers'
import {
  candidatosProduto,
  chaveFornecedor,
  divergenciaTotal,
  fatorDeConversao,
  fatorPorUnidades,
  normalizarTexto,
  notaFormError,
  quantidadeNoEstoque,
  somaItens,
  sugerirProduto,
  unidadeDaNota,
  type NotaLida,
  type SugestaoProduto,
} from './notaHelpers'
import {
  NOTA_MAPEAMENTOS_KEY,
  lancarNota,
  lerNotaFiscal,
  removerNotaFoto,
  uploadNotaFoto,
  useNotaMapeamentos,
} from './useNotaFiscal'
import { formatCusto, formatQuantidade } from './cmvHelpers'
import { ProdutoNotaPicker } from './ProdutoNotaPicker'
import type { ContaPagarRow, EstoqueItemRow } from '../../types/database'

interface LinhaItem {
  descricao: string
  quantidade: number
  unidade: string
  valor_unitario: number
  valor_total: number
  produtoId: string | null
  origem: SugestaoProduto['origem'] | null
  // Unidades do estoque por 1 da nota (1 CX = 12 UN → 12); vem do vínculo aprendido.
  fator: number
  darEntrada: boolean
  qtdEntrada: string
}

const paraNumero = (texto: string) => Number(texto.replace(',', '.')) || 0
const paraTexto = (n: number) => String(Number(n.toFixed(3))).replace('.', ',')

const CATEGORIA_POR_SETOR: Record<string, string> = {
  Bar: 'Mercadoria – Bebidas',
  Cozinha: 'Mercadoria – Alimentos',
}

function formaPagamentoConhecida(texto: string): string {
  const t = normalizarTexto(texto)
  if (t.includes('pix')) return 'Pix'
  if (t.includes('cart') || t.includes('credito') || t.includes('debito')) return 'Cartão'
  if (t.includes('dinheiro') || t.includes('especie')) return 'Dinheiro'
  if (t.includes('boleto')) return 'Boleto'
  return ''
}

export function LerNotaModal({
  contas,
  onClose,
  onSaved,
}: {
  contas: ContaPagarRow[]
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const profile = useAuthStore((s) => s.profile)
  const queryClient = useQueryClient()
  const { data: estoque } = useEstoqueItens()
  const { data: mapeamentos } = useNotaMapeamentos()

  const [etapa, setEtapa] = useState<'foto' | 'lendo' | 'revisar'>('foto')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [foto, setFoto] = useState<Blob | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  // Dados da nota, editáveis na conferência.
  const [leitura, setLeitura] = useState<NotaLida | null>(null)
  const [descricao, setDescricao] = useState('')
  const [fornecedor, setFornecedor] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [numeroNota, setNumeroNota] = useState('')
  const [chave, setChave] = useState('')
  const [vencimento, setVencimento] = useState('')
  const [valorTexto, setValorTexto] = useState('')
  const [categoria, setCategoria] = useState('Outros')
  const [jaPaga, setJaPaga] = useState(false)
  const [pagoEm, setPagoEm] = useState('')
  const [forma, setForma] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [linhas, setLinhas] = useState<LinhaItem[]>([])

  const previaUrl = useMemo(() => (arquivo ? URL.createObjectURL(arquivo) : null), [arquivo])
  useEffect(
    () => () => {
      if (previaUrl) URL.revokeObjectURL(previaUrl)
    },
    [previaUrl],
  )

  const [escolhendo, setEscolhendo] = useState<number | null>(null)

  const produtos = useMemo(() => (estoque ?? []).map((i) => ({ id: i.id, title: i.title, marca: i.marca })), [estoque])
  const porId = useMemo(() => new Map((estoque ?? []).map((i) => [i.id, i] as const)), [estoque])

  // Foto: a função ler-nota (IA) devolve os dados; vai pra conferência.
  async function ler() {
    if (!arquivo) return
    setErro(null)
    setEtapa('lendo')
    try {
      const { nota, foto: fotoReduzida } = await lerNotaFiscal(arquivo)
      carregarNota(nota, fotoReduzida)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível ler a nota.')
      setEtapa('foto')
    }
  }

  // XML da NF-e: leitura exata no próprio navegador, sem IA e sem foto.
  async function importarXml(file: File) {
    setErro(null)
    try {
      carregarNota(lerXmlNfe(await file.text()), null)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível ler o XML.')
    }
  }

  function carregarNota(nota: NotaLida, fotoReduzida: Blob | null) {
    if (!nota.legivel) {
      setErro(nota.observacoes || 'Não consegui ler uma nota fiscal nesta foto. Tente de novo, com a nota reta e bem iluminada.')
      setEtapa('foto')
      return
    }
    const hoje = isoDate(new Date())
    const emissao = nota.data_emissao || hoje
    const fornecedorChave = chaveFornecedor(nota.cnpj, nota.fornecedor)

    const novasLinhas: LinhaItem[] = nota.itens.map((i) => {
      const sug = sugerirProduto(i.descricao, fornecedorChave, produtos, mapeamentos ?? [])
      const prod = sug ? (estoque ?? []).find((e) => e.id === sug.estoqueItemId) : undefined
      // Conversão: a que já foi aprendida; senão, a deduzida das unidades; senão, 1.
      const fator = (sug?.origem === 'aprendido' ? sug.fator : prod ? fatorPorUnidades(i.unidade, prod) : null) ?? 1
      return {
        ...i,
        produtoId: prod?.id ?? null,
        origem: sug?.origem ?? null,
        fator,
        // Já vem tudo preenchido (produto, entrada e quantidade convertida); o
        // que é só "parecido" fica marcado "Sugerido, confira" na conferência.
        darEntrada: !!prod,
        qtdEntrada: prod && i.quantidade ? paraTexto(quantidadeNoEstoque(i.quantidade, fator)) : '',
      }
    })

    const primeiro = novasLinhas.map((l) => (l.produtoId ? porId.get(l.produtoId) : undefined)).find(Boolean)
    setLeitura(nota)
    setFoto(fotoReduzida)
    setDescricao(`${nota.numero_nota ? `NF ${nota.numero_nota}` : 'Nota fiscal'}${nota.fornecedor ? ` – ${nota.fornecedor}` : ''}`)
    setFornecedor(nota.fornecedor)
    setCnpj(nota.cnpj)
    setNumeroNota(nota.numero_nota)
    setChave(nota.chave_acesso)
    setVencimento(nota.vencimento || emissao)
    setValorTexto(nota.valor_total ? nota.valor_total.toFixed(2).replace('.', ',') : '')
    setCategoria(primeiro ? (CATEGORIA_POR_SETOR[primeiro.categoria] ?? 'Mercadoria – Outros insumos') : 'Outros')
    const formaConhecida = formaPagamentoConhecida(nota.forma_pagamento)
    // Cupom pago no balcão já está pago; nota a prazo (duplicata no XML ou boleto) fica a pagar.
    setJaPaga(!!nota.forma_pagamento && !nota.vencimento && formaConhecida !== 'Boleto')
    setPagoEm(emissao)
    setForma(formaConhecida)
    setObservacoes(nota.observacoes)
    setLinhas(novasLinhas)
    setEtapa('revisar')
  }

  function atualizarLinha(i: number, parcial: Partial<LinhaItem>) {
    setLinhas((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...parcial } : l)))
  }

  function escolherProduto(i: number, prod: EstoqueItemRow | null) {
    setEscolhendo(null)
    const l = linhas[i]
    if (!prod) {
      // Sem vínculo: nada entra no estoque.
      atualizarLinha(i, { produtoId: null, origem: null, fator: 1, darEntrada: false })
      return
    }
    if (prod.id === l.produtoId) return
    // Se este fornecedor já teve esta descrição ligada a este produto, a conversão vem de lá.
    const aprendido = (mapeamentos ?? []).find(
      (m) =>
        m.fornecedor_chave === chaveFornecedor(cnpj, fornecedor) &&
        m.descricao_norm === normalizarTexto(l.descricao) &&
        m.estoque_item_id === prod.id,
    )
    const fator = (aprendido && aprendido.fator > 0 ? aprendido.fator : fatorPorUnidades(l.unidade, prod)) ?? 1
    atualizarLinha(i, {
      produtoId: prod.id,
      // Escolha manual vale como conferida.
      origem: 'aprendido',
      fator,
      darEntrada: true,
      qtdEntrada: l.quantidade ? paraTexto(quantidadeNoEstoque(l.quantidade, fator)) : '',
    })
  }

  const valor = parseValorBR(valorTexto)
  const itensLidos = linhas.map((l) => ({ valor_total: l.valor_total }))
  const diferenca = valor != null ? divergenciaTotal(valor, itensLidos) : 0
  const duplicadaPorChave = chave ? contas.find((c) => c.chave_acesso === chave) : undefined
  const duplicadaPorNumero =
    !duplicadaPorChave && cnpj && numeroNota
      ? contas.find((c) => c.fornecedor_cnpj === cnpj && c.numero_nota === numeroNota)
      : undefined

  async function salvar() {
    if (!profile) return
    const msg = notaFormError({
      descricao,
      valor,
      vencimento,
      pagaEm: jaPaga ? pagoEm : null,
      pagaSemData: jaPaga && !pagoEm,
    })
    if (msg || valor == null) return setErro(msg)
    if (duplicadaPorChave) return setErro('Esta nota já foi lançada (mesma chave de acesso).')
    if (duplicadaPorNumero && !(await confirmar(`Já existe uma conta com a nota nº ${numeroNota} deste fornecedor. Lançar mesmo assim?`))) return

    const resolvidas = linhas.map((l) => ({ l, prod: l.produtoId ? porId.get(l.produtoId) : undefined }))
    const comEntrada = resolvidas.filter(({ l, prod }) => prod && l.darEntrada)
    for (const { l } of comEntrada) {
      if (!(paraNumero(l.qtdEntrada) > 0)) return setErro(`Informe a quantidade de entrada de "${l.descricao}".`)
    }
    const sugeridos = comEntrada.filter(({ l }) => l.origem === 'sugerido').length
    const resumoEstoque = comEntrada.length
      ? `\nDar entrada no estoque de ${comEntrada.length} ${comEntrada.length === 1 ? 'produto' : 'produtos'}.` +
        (sugeridos ? `\n${sugeridos} ${sugeridos === 1 ? 'vínculo foi só sugerido' : 'vínculos foram só sugeridos'} pelo nome: confirme que estão certos.` : '')
      : '\nNenhuma entrada de estoque será feita.'
    if (!(await confirmar(`Lançar a nota de ${formatBRL(valor)}${jaPaga ? ' (já paga)' : ''}?${resumoEstoque}`))) return

    setErro(null)
    setSalvando(true)
    let fotoPath: string | null = null
    try {
      if (foto) fotoPath = await uploadNotaFoto(profile.id, foto)
      await lancarNota(
        {
          descricao,
          fornecedor,
          fornecedorCnpj: cnpj,
          categoria,
          valor,
          vencimento,
          // Sem data de emissão legível, vale o dia em que a nota está sendo lançada.
          dataCompra: leitura?.data_emissao || isoDate(diaOperacional()),
          observacoes,
          numeroNota,
          chaveAcesso: chave,
          fotoPath,
          itensNota: resolvidas.map(({ l, prod }) => ({
            descricao: l.descricao,
            quantidade: l.quantidade,
            unidade: l.unidade,
            valor_unitario: l.valor_unitario,
            valor_total: l.valor_total,
            estoque_item_id: prod?.id ?? null,
          })),
          pagoEm: jaPaga ? pagoEm : null,
          formaPagamento: jaPaga ? forma || null : null,
        },
        resolvidas
          .filter(({ prod }) => prod)
          .map(({ l, prod }) => ({
            estoqueItemId: prod!.id,
            quantidade: paraNumero(l.qtdEntrada),
            darEntrada: l.darEntrada,
            descricaoNorm: normalizarTexto(l.descricao),
            valorTotal: l.valor_total,
            // O que a pessoa conferiu vira a conversão lembrada pra próxima nota.
            fator: (l.darEntrada && fatorDeConversao(l.quantidade, paraNumero(l.qtdEntrada))) || l.fator,
          })),
        chaveFornecedor(cnpj, fornecedor),
      )
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ESTOQUE_ITENS_KEY }),
        queryClient.invalidateQueries({ queryKey: ESTOQUE_MOVIMENTOS_KEY }),
        queryClient.invalidateQueries({ queryKey: NOTA_MAPEAMENTOS_KEY }),
      ])
      await onSaved()
    } catch (err) {
      // A conta não foi criada: a foto enviada não deve ficar solta no bucket.
      if (fotoPath) await removerNotaFoto(fotoPath)
      setErro(err instanceof Error ? err.message : 'Erro ao lançar a nota.')
    } finally {
      setSalvando(false)
    }
  }

  const linhaEscolhendo = escolhendo != null ? linhas[escolhendo] : undefined

  return (
    <>
    <div className="modal-overlay">
      <div className="modal modal-wide">
        <div className="modal-header">
          <h3>Ler nota fiscal</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {etapa !== 'revisar' && (
          <div className="modal-body">
            <p className="page-subtitle" style={{ marginBottom: 12 }}>
              Tire uma foto da nota ou do cupom fiscal (reta, bem iluminada, com todos os itens) ou escolha uma imagem da
              galeria. Você confere tudo antes de salvar.
            </p>
            <div className="field">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                disabled={etapa === 'lendo'}
                onChange={(e) => {
                  setArquivo(e.target.files?.[0] ?? null)
                  setErro(null)
                }}
              />
            </div>
            <div className="field">
              <label>Ou importe o XML da NF-e (o arquivo que o fornecedor envia por e-mail)</label>
              <input
                type="file"
                accept=".xml,text/xml,application/xml"
                disabled={etapa === 'lendo'}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void importarXml(f)
                  e.target.value = ''
                }}
              />
              <span className="field-hint">Leitura exata, sem IA e sem custo; traz todos os itens e valores.</span>
            </div>
            {previaUrl && (
              <img
                src={previaUrl}
                alt="Prévia da nota"
                style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 8, display: 'block', margin: '8px auto' }}
              />
            )}
            {etapa === 'lendo' && <p className="field-hint">Lendo a nota… isso leva alguns segundos.</p>}
            {erro && <p className="login-error">{erro}</p>}
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" onClick={ler} disabled={!arquivo || etapa === 'lendo'}>
                {etapa === 'lendo' ? 'Lendo...' : 'Ler nota'}
              </button>
            </div>
          </div>
        )}

        {etapa === 'revisar' && leitura && (
          <div className="modal-body">
            <p className="page-subtitle" style={{ marginBottom: 12 }}>
              Confira o que foi lido — a leitura pode errar vírgulas, quantidades e valores. Nada foi salvo ainda.
            </p>
            {leitura.observacoes && <p className="field-hint">Aviso da leitura: {leitura.observacoes}</p>}
            {duplicadaPorChave && <p className="login-error">Esta nota já foi lançada (mesma chave de acesso).</p>}
            {duplicadaPorNumero && (
              <p className="login-error">Já existe uma conta com a nota nº {numeroNota} deste fornecedor.</p>
            )}

            <h4 className="section-label">Conta a pagar</h4>
            <div className="field">
              <label>Descrição *</label>
              <input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            </div>
            <div className="field-row">
              <div className="field">
                <label>Fornecedor</label>
                <input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} />
              </div>
              <div className="field">
                <label>Nº da nota</label>
                <input value={numeroNota} onChange={(e) => setNumeroNota(e.target.value)} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Valor total (R$) *</label>
                <input inputMode="decimal" value={valorTexto} onChange={(e) => setValorTexto(e.target.value)} />
                {valor != null && valor > 0 && <span className="field-hint">{formatBRL(valor)}</span>}
              </div>
              <div className="field">
                <label>Vencimento *</label>
                <input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
              </div>
              <div className="field">
                <label>Categoria</label>
                <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                  {CONTA_CATEGORIAS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label>Esta nota já foi paga?</label>
              <div className="sector-filter">
                <button type="button" className={`sector-filter-btn ${!jaPaga ? 'active' : ''}`} onClick={() => setJaPaga(false)}>
                  Ainda não (a pagar)
                </button>
                <button type="button" className={`sector-filter-btn ${jaPaga ? 'active' : ''}`} onClick={() => setJaPaga(true)}>
                  Já paga
                </button>
              </div>
            </div>
            {jaPaga && (
              <div className="field-row">
                <div className="field">
                  <label>Data do pagamento *</label>
                  <input type="date" value={pagoEm} onChange={(e) => setPagoEm(e.target.value)} />
                </div>
                <div className="field">
                  <label>Forma de pagamento</label>
                  <select value={forma} onChange={(e) => setForma(e.target.value)}>
                    <option value="">Selecione...</option>
                    {FORMAS_PAGAMENTO.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <h4 className="section-label">
              Itens da nota ({linhas.length}
              {linhas.length > 0 && ` · ${linhas.filter((l) => l.produtoId).length} vinculados ao estoque`})
            </h4>
            {linhas.length > 0 && (
              <p className="field-hint">
                Soma dos itens: {formatBRL(somaItens(itensLidos))}
                {Math.abs(diferenca) > 0.05 && valor != null && (
                  <strong style={{ color: 'var(--gold-bright)' }}>
                    {' '}
                    · diferente do total em {formatBRL(Math.abs(diferenca))} (frete, desconto ou erro de leitura — confira)
                  </strong>
                )}
              </p>
            )}
            <div className="manage-list">
              {linhas.map((l, i) => {
                const prod = l.produtoId ? porId.get(l.produtoId) : undefined
                const qtdEstoque = paraNumero(l.qtdEntrada)
                // Enquanto não há vínculo conferido, oferece os nomes do estoque que aparecem na descrição.
                const sugestoes = l.origem === 'aprendido' ? [] : candidatosProduto(l.descricao, estoque ?? []).filter((p) => p.id !== l.produtoId)
                const unidadeDiferente = !!prod && !!l.unidade && unidadeDaNota(l.unidade) !== prod.unidade
                const mudouUnidade = prod && l.darEntrada && qtdEstoque > 0 && l.quantidade > 0 && qtdEstoque !== l.quantidade
                return (
                  <div className="manage-row" key={i} style={{ display: 'block' }}>
                    <strong>{l.descricao}</strong>
                    <span className="field-hint">
                      Na nota: {formatQuantidade(l.quantidade)} {l.unidade} × {formatBRL(l.valor_unitario)} = {formatBRL(l.valor_total)}
                    </span>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                      {prod ? (
                        <>
                          <span>
                            <strong>{prod.title}</strong>
                            {prod.marca ? ` · ${prod.marca}` : ''}
                            <span className="field-hint" style={{ display: 'inline', marginLeft: 6 }}>
                              saldo {formatQuantidade(prod.quantidade)} {prod.unidade.toLowerCase()}
                            </span>
                          </span>
                          {l.origem === 'sugerido' && <span className="badge-status badge-status-pendente">Sugerido, confira</span>}
                          {l.origem === 'aprendido' && <span className="badge-status badge-status-ativa">Vinculado</span>}
                        </>
                      ) : (
                        <span className="badge-status badge-status-bloqueada">Sem vínculo</span>
                      )}
                      <button type="button" className="btn btn-ghost" onClick={() => setEscolhendo(i)}>
                        {prod ? 'Trocar produto' : 'Vincular produto'}
                      </button>
                    </div>

                    {sugestoes.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                        <span className="field-hint">Parece ser:</span>
                        {sugestoes.map((p) => (
                          <button key={p.id} type="button" className="btn btn-ghost" onClick={() => escolherProduto(i, p)}>
                            {p.title}
                            {p.marca ? ` · ${p.marca}` : ''}
                          </button>
                        ))}
                      </div>
                    )}

                    {prod && (
                      <div style={{ marginTop: 8 }}>
                        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            type="checkbox"
                            checked={l.darEntrada}
                            onChange={(e) =>
                              atualizarLinha(i, {
                                darEntrada: e.target.checked,
                                qtdEntrada: l.qtdEntrada || (l.quantidade ? paraTexto(quantidadeNoEstoque(l.quantidade, l.fator)) : ''),
                              })
                            }
                          />
                          Dar entrada no estoque
                        </label>
                        {l.darEntrada && (
                          <div className="field" style={{ marginTop: 6 }}>
                            <label>Quantidade que entra no estoque ({prod.unidade.toLowerCase()})</label>
                            <input
                              inputMode="decimal"
                              value={l.qtdEntrada}
                              onChange={(e) => atualizarLinha(i, { qtdEntrada: e.target.value })}
                              style={{ maxWidth: 120 }}
                            />
                            <span className="field-hint">
                              {mudouUnidade
                                ? `Conversão: 1 ${l.unidade || 'da nota'} = ${formatQuantidade(qtdEstoque / l.quantidade)} ${prod.unidade.toLowerCase()} (o app lembra pra próxima nota). `
                                : unidadeDiferente
                                  ? `A nota vem em ${l.unidade} e o estoque é em ${prod.unidade.toLowerCase()}: confira a quantidade. `
                                  : 'Mesma unidade do estoque. '}
                              {qtdEstoque > 0 && l.valor_total > 0 && `Custo: ${formatCusto(l.valor_total / qtdEstoque)} por ${prod.unidade.toLowerCase()}.`}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="field">
              <label>Observações</label>
              <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
            </div>

            {erro && <p className="login-error">{erro}</p>}
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setEtapa('foto')} disabled={salvando}>
                Trocar foto
              </button>
              <button type="button" className="btn btn-primary" onClick={salvar} disabled={salvando || !!duplicadaPorChave}>
                {salvando ? 'Lançando...' : 'Lançar nota'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
    {linhaEscolhendo && (
      <ProdutoNotaPicker
        descricaoNota={linhaEscolhendo.descricao}
        produtos={estoque ?? []}
        selecionadoId={linhaEscolhendo.produtoId}
        onEscolher={(p) => escolherProduto(escolhendo as number, p)}
        onClose={() => setEscolhendo(null)}
      />
    )}
    </>
  )
}
