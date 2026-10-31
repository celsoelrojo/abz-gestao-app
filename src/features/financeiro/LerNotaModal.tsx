import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { confirmar } from '../../store/confirmStore'
import { isoDate } from '../../lib/date'
import { useEstoqueItens, ESTOQUE_ITENS_KEY, ESTOQUE_MOVIMENTOS_KEY } from '../estoque/useEstoque'
import { useQueryClient } from '@tanstack/react-query'
import { CONTA_CATEGORIAS, FORMAS_PAGAMENTO } from './financeiroConstants'
import { lerXmlNfe } from './nfeXml'
import { formatBRL, parseValorBR } from './contaHelpers'
import {
  chaveFornecedor,
  divergenciaTotal,
  normalizarTexto,
  notaFormError,
  somaItens,
  sugerirProduto,
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
import type { ContaPagarRow, EstoqueItemRow } from '../../types/database'

interface LinhaItem {
  descricao: string
  quantidade: number
  unidade: string
  valor_unitario: number
  valor_total: number
  produtoTexto: string
  origem: SugestaoProduto['origem'] | null
  darEntrada: boolean
  qtdEntrada: string
}

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

  const produtos = useMemo(() => (estoque ?? []).map((i) => ({ id: i.id, title: i.title })), [estoque])
  const porTitulo = useMemo(() => {
    const m = new Map<string, EstoqueItemRow>()
    for (const i of estoque ?? []) m.set(i.title.toLowerCase(), i)
    return m
  }, [estoque])

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
      return {
        ...i,
        produtoTexto: prod?.title ?? '',
        origem: sug?.origem ?? null,
        // Só o que o app JÁ aprendeu vem marcado pra dar entrada; o que é só
        // "parecido" fica desmarcado até a pessoa conferir o produto.
        darEntrada: sug?.origem === 'aprendido',
        qtdEntrada: String(i.quantidade || ''),
      }
    })

    const primeiro = novasLinhas.map((l) => porTitulo.get(l.produtoTexto.toLowerCase())).find(Boolean)
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

  function escolherProduto(i: number, texto: string) {
    const prod = porTitulo.get(texto.trim().toLowerCase())
    atualizarLinha(i, {
      produtoTexto: texto,
      // Escolha manual vale como conferida; apagar o produto desmarca a entrada.
      origem: prod ? 'aprendido' : null,
      darEntrada: prod ? true : false,
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

    const resolvidas = linhas.map((l) => ({ l, prod: porTitulo.get(l.produtoTexto.trim().toLowerCase()) }))
    const comEntrada = resolvidas.filter(({ l, prod }) => prod && l.darEntrada)
    for (const { l } of comEntrada) {
      if (!(Number(l.qtdEntrada.replace(',', '.')) > 0)) return setErro(`Informe a quantidade de entrada de "${l.descricao}".`)
    }
    const resumoEstoque = comEntrada.length
      ? `\nDar entrada no estoque de ${comEntrada.length} ${comEntrada.length === 1 ? 'produto' : 'produtos'}.`
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
            quantidade: Number(l.qtdEntrada.replace(',', '.')) || 0,
            darEntrada: l.darEntrada,
            descricaoNorm: normalizarTexto(l.descricao),
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

  return (
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

            <h4 className="section-label">Itens da nota ({linhas.length})</h4>
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
            <datalist id="produtos-estoque-nota">
              {(estoque ?? []).map((i) => (
                <option key={i.id} value={i.title} />
              ))}
            </datalist>
            <div className="manage-list">
              {linhas.map((l, i) => {
                const prod = porTitulo.get(l.produtoTexto.trim().toLowerCase())
                return (
                  <div className="manage-row" key={i} style={{ display: 'block' }}>
                    <strong>{l.descricao}</strong>
                    <span className="field-hint">
                      {l.quantidade} {l.unidade} × {formatBRL(l.valor_unitario)} = {formatBRL(l.valor_total)}
                    </span>
                    <div className="field" style={{ marginTop: 8 }}>
                      <label>
                        Produto do estoque{' '}
                        {l.origem === 'sugerido' && prod && <em style={{ color: 'var(--gold-bright)' }}>— sugerido, confira</em>}
                        {l.origem === 'aprendido' && prod && <em style={{ color: 'var(--success)' }}>— reconhecido</em>}
                      </label>
                      <input
                        list="produtos-estoque-nota"
                        value={l.produtoTexto}
                        onChange={(e) => escolherProduto(i, e.target.value)}
                        placeholder="Digite para buscar (deixe vazio se não for para o estoque)"
                      />
                    </div>
                    {prod && (
                      <div className="field-row" style={{ alignItems: 'center' }}>
                        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            type="checkbox"
                            checked={l.darEntrada}
                            onChange={(e) => atualizarLinha(i, { darEntrada: e.target.checked })}
                          />
                          Dar entrada no estoque
                        </label>
                        {l.darEntrada && (
                          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            Quantidade
                            <input
                              inputMode="decimal"
                              value={l.qtdEntrada}
                              onChange={(e) => atualizarLinha(i, { qtdEntrada: e.target.value })}
                              style={{ maxWidth: 90 }}
                            />
                            {prod.unidade} (unidade do estoque)
                          </label>
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
  )
}
