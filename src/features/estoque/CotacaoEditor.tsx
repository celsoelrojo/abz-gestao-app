import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isoDate } from '../../lib/date'
import { avisar, confirmar } from '../../store/confirmStore'
import { formatBRL, parseValorBR } from '../financeiro/contaHelpers'
import { formatQuantidade } from '../financeiro/cmvHelpers'
import {
  escolherMaisBarato,
  itemDeCotacao,
  menorPreco,
  novoId,
  precoDe,
  problemasParaGerarPedidos,
  textoPedidoDeCotacao,
  totaisDaEscolha,
  type CotacaoEstado,
} from './cotacaoHelpers'
import { COTACOES_KEY, gerarPedidosDaCotacao, salvarCotacao } from './useCotacoes'
import { sugestaoCompra } from './estoqueHelpers'
import { PEDIDOS_COMPRA_KEY, usePedidosCompra } from './usePedidosCompra'
import { useEstoqueItens } from './useEstoque'

const paraTexto = (n: number | null | undefined) => (n == null ? '' : String(Number(n.toFixed(4))).replace('.', ','))

const amanha = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return isoDate(d)
}

// Compara preços de fornecedores diferentes para os mesmos produtos. Os preços
// são por unidade do estoque (fardo, litro, quilo...). Enquanto a pessoa não
// escolhe na mão, o app marca o fornecedor mais barato de cada produto.
export function CotacaoEditor({
  inicial,
  somenteLeitura = false,
  onClose,
}: {
  inicial: CotacaoEstado
  somenteLeitura?: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const { data: estoque } = useEstoqueItens()
  const { data: pedidos } = usePedidosCompra()

  const [estado, setEstado] = useState<CotacaoEstado>(inicial)
  // Texto digitado em cada preço (a vírgula e o campo vazio não cabem num número).
  const [textos, setTextos] = useState<Record<string, Record<string, string>>>(() =>
    Object.fromEntries(Object.entries(inicial.precos).map(([item, porF]) => [item, Object.fromEntries(Object.entries(porF).map(([f, p]) => [f, paraTexto(p)]))])),
  )
  // Produtos em que a pessoa escolheu o fornecedor na mão: os demais seguem o menor preço.
  const [manuais, setManuais] = useState<Set<string>>(
    () => new Set(inicial.itens.filter((it) => it.escolhidoId && it.escolhidoId !== menorPreco(inicial, it.id)?.fornecedorId).map((it) => it.id)),
  )
  // Idem para a quantidade de cada produto.
  const [qtdTextos, setQtdTextos] = useState<Record<string, string>>({})
  const [novoFornecedor, setNovoFornecedor] = useState('')
  const [buscaProduto, setBuscaProduto] = useState('')
  const [dataEntrega, setDataEntrega] = useState(amanha())
  const [sujo, setSujo] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const totais = useMemo(() => totaisDaEscolha(estado), [estado])
  const fornecedoresConhecidos = useMemo(
    () => Array.from(new Set((pedidos ?? []).map((p) => p.fornecedor.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [pedidos],
  )

  const resultadosBusca = useMemo(() => {
    const termo = buscaProduto.trim().toLowerCase()
    if (!termo) return []
    const jaTem = new Set(estado.itens.map((i) => i.estoqueItemId))
    return (estoque ?? [])
      .filter((i) => !jaTem.has(i.id) && (i.title.toLowerCase().includes(termo) || (i.marca ?? '').toLowerCase().includes(termo)))
      .slice(0, 8)
  }, [buscaProduto, estoque, estado.itens])

  function mudar(fn: (e: CotacaoEstado) => CotacaoEstado) {
    setSujo(true)
    setEstado(fn)
  }

  // Aplica o menor preço aos produtos que não foram escolhidos na mão.
  function seguirMenorPreco(e: CotacaoEstado, manuaisAtuais: Set<string>): CotacaoEstado {
    return { ...e, itens: e.itens.map((it) => (manuaisAtuais.has(it.id) ? it : { ...it, escolhidoId: menorPreco(e, it.id)?.fornecedorId ?? null })) }
  }

  function definirPreco(itemId: string, fornecedorId: string, texto: string) {
    setTextos((t) => ({ ...t, [itemId]: { ...t[itemId], [fornecedorId]: texto } }))
    const valor = texto.trim() ? parseValorBR(texto, 4) : null
    mudar((e) => seguirMenorPreco({ ...e, precos: { ...e.precos, [itemId]: { ...e.precos[itemId], [fornecedorId]: valor } } }, manuais))
  }

  function escolher(itemId: string, fornecedorId: string) {
    const novos = new Set(manuais).add(itemId)
    setManuais(novos)
    mudar((e) => ({ ...e, itens: e.itens.map((it) => (it.id === itemId ? { ...it, escolhidoId: fornecedorId } : it)) }))
  }

  function adicionarFornecedor() {
    const nome = novoFornecedor.trim()
    if (!nome) return
    if (estado.fornecedores.some((f) => f.nome.toLowerCase() === nome.toLowerCase())) {
      setErro(`"${nome}" já está na cotação.`)
      return
    }
    setErro(null)
    setNovoFornecedor('')
    mudar((e) => ({ ...e, fornecedores: [...e.fornecedores, { id: novoId(), nome, observacoes: '' }] }))
  }

  async function removerFornecedor(id: string) {
    const f = estado.fornecedores.find((x) => x.id === id)
    const temPreco = estado.itens.some((it) => precoDe(estado.precos, it.id, id) != null)
    if (temPreco && !(await confirmar(`Remover "${f?.nome}" e os preços digitados dele?`))) return
    mudar((e) => seguirMenorPreco({ ...e, fornecedores: e.fornecedores.filter((x) => x.id !== id) }, manuais))
  }

  function adicionarProduto(id: string) {
    const item = (estoque ?? []).find((i) => i.id === id)
    if (!item) return
    setBuscaProduto('')
    mudar((e) => ({ ...e, itens: [...e.itens, itemDeCotacao(item, sugestaoCompra(item))] }))
  }

  function validarParaSalvar(): string | null {
    if (estado.itens.some((it) => !(it.quantidade > 0))) return 'Informe a quantidade de todos os produtos.'
    return null
  }

  async function executar(acao: () => Promise<void>, padrao: string) {
    setErro(null)
    setOcupado(true)
    try {
      await acao()
    } catch (err) {
      setErro(err instanceof Error ? err.message : padrao)
    } finally {
      setOcupado(false)
    }
  }

  const salvar = () =>
    executar(async () => {
      const problema = validarParaSalvar()
      if (problema) return setErro(problema)
      const id = await salvarCotacao({ ...estado, titulo: estado.titulo.trim() })
      setEstado((e) => ({ ...e, id }))
      setSujo(false)
      await queryClient.invalidateQueries({ queryKey: COTACOES_KEY })
      void avisar('Cotação salva. Você pode continuar depois em Estoque e Compras → Cotações.')
    }, 'Não foi possível salvar a cotação.')

  const gerar = () =>
    executar(async () => {
      const problemas = problemasParaGerarPedidos(estado)
      if (problemas.length > 0) return setErro(problemas.join(' '))
      const fornecedoresEscolhidos = estado.fornecedores.filter((f) => totais.porFornecedor[f.id] != null)
      const resumo = fornecedoresEscolhidos.map((f) => `${f.nome}: ${formatBRL(totais.porFornecedor[f.id])}`).join('\n')
      if (!(await confirmar(`Gerar ${fornecedoresEscolhidos.length} ${fornecedoresEscolhidos.length === 1 ? 'pedido' : 'pedidos'} de compra, com entrega em ${dataEntrega.split('-').reverse().join('/')}?\n${resumo}\nTotal: ${formatBRL(totais.total)}`))) return
      const id = await salvarCotacao({ ...estado, titulo: estado.titulo.trim() })
      const n = await gerarPedidosDaCotacao(id, dataEntrega)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: COTACOES_KEY }),
        queryClient.invalidateQueries({ queryKey: PEDIDOS_COMPRA_KEY }),
      ])
      await avisar(`${n} ${n === 1 ? 'pedido criado' : 'pedidos criados'}. Acompanhe em Estoque e Compras → Pedidos de Compra.`)
      onClose()
    }, 'Não foi possível gerar os pedidos.')

  async function copiarPedido() {
    try {
      await navigator.clipboard.writeText(textoPedidoDeCotacao(estado))
      void avisar('Texto copiado. Cole no WhatsApp ou no e-mail para pedir o preço aos fornecedores.')
    } catch {
      setErro('Não foi possível copiar. Selecione e copie manualmente.')
    }
  }

  async function fechar() {
    if (sujo && !somenteLeitura && !(await confirmar('Há alterações não salvas. Sair e descartar?'))) return
    onClose()
  }

  const bloqueado = somenteLeitura || ocupado

  return (
    <div className="modal-overlay">
      <div className="modal modal-wide">
        <div className="modal-header">
          <h3>{somenteLeitura ? 'Cotação finalizada' : 'Cotação de produtos'}</h3>
          <button className="modal-close" onClick={fechar}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Nome da cotação</label>
            <input value={estado.titulo} disabled={bloqueado} maxLength={80} onChange={(e) => mudar((s) => ({ ...s, titulo: e.target.value }))} />
          </div>

          <h4 className="section-label">Fornecedores consultados ({estado.fornecedores.length})</h4>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            {estado.fornecedores.map((f) => (
              <span key={f.id} className="badge-status badge-status-pendente" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', textTransform: 'none' }}>
                {f.nome}
                {!bloqueado && (
                  <button type="button" onClick={() => removerFornecedor(f.id)} aria-label={`Remover ${f.nome}`} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
                    ✕
                  </button>
                )}
              </span>
            ))}
          </div>
          {!bloqueado && (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                list="fornecedores-conhecidos"
                value={novoFornecedor}
                placeholder="Nome do fornecedor"
                onChange={(e) => setNovoFornecedor(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    adicionarFornecedor()
                  }
                }}
              />
              <datalist id="fornecedores-conhecidos">
                {fornecedoresConhecidos.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
              <button type="button" className="btn btn-ghost" onClick={adicionarFornecedor} disabled={!novoFornecedor.trim()}>
                Adicionar
              </button>
            </div>
          )}

          <h4 className="section-label" style={{ marginTop: 20 }}>
            Produtos ({estado.itens.length})
          </h4>
          {!bloqueado && (
            <div style={{ marginBottom: 8 }}>
              <input value={buscaProduto} placeholder="Buscar produto do estoque para adicionar…" onChange={(e) => setBuscaProduto(e.target.value)} />
              {resultadosBusca.map((i) => (
                <button key={i.id} type="button" className="manage-row" style={{ width: '100%', textAlign: 'left', cursor: 'pointer', color: 'inherit', font: 'inherit', marginTop: 4 }} onClick={() => adicionarProduto(i.id)}>
                  <div className="manage-row-info">
                    <strong>{i.title}</strong>
                    <span>
                      {i.categoria} · saldo {formatQuantidade(i.quantidade)} {i.unidade.toLowerCase()}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
          {estado.itens.length === 0 && <div className="empty-state">Adicione os produtos que quer cotar.</div>}

          <div className="manage-list">
            {estado.itens.map((it) => {
              const menor = menorPreco(estado, it.id)
              return (
                <div className="manage-row" key={it.id} style={{ display: 'block' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong style={{ flex: 1 }}>{it.produto}</strong>
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      Quantidade
                      <input
                        inputMode="decimal"
                        value={qtdTextos[it.id] ?? paraTexto(it.quantidade)}
                        disabled={bloqueado}
                        style={{ maxWidth: 80 }}
                        onChange={(e) => {
                          const texto = e.target.value
                          setQtdTextos((t) => ({ ...t, [it.id]: texto }))
                          mudar((s) => ({ ...s, itens: s.itens.map((x) => (x.id === it.id ? { ...x, quantidade: parseValorBR(texto, 3) ?? 0 } : x)) }))
                        }}
                      />
                      {it.unidade.toLowerCase()}
                    </label>
                    {!bloqueado && (
                      <button type="button" className="icon-btn" title="Remover produto" onClick={() => mudar((s) => ({ ...s, itens: s.itens.filter((x) => x.id !== it.id) }))}>
                        ✕
                      </button>
                    )}
                  </div>

                  {estado.fornecedores.length === 0 && <p className="field-hint">Adicione fornecedores para digitar os preços.</p>}
                  {estado.fornecedores.map((f) => {
                    const preco = precoDe(estado.precos, it.id, f.id)
                    const escolhido = it.escolhidoId === f.id
                    return (
                      <div key={f.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
                        <label style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1, minWidth: 140 }}>
                          <input type="radio" name={`escolha-${it.id}`} checked={escolhido} disabled={bloqueado || preco == null} onChange={() => escolher(it.id, f.id)} />
                          {f.nome}
                          {menor?.fornecedorId === f.id && <span className="badge-status badge-status-ativa">Menor preço</span>}
                        </label>
                        <input
                          inputMode="decimal"
                          placeholder={`R$ por ${it.unidade.toLowerCase()}`}
                          value={textos[it.id]?.[f.id] ?? ''}
                          disabled={bloqueado}
                          style={{ maxWidth: 130, textAlign: 'right' }}
                          onChange={(e) => definirPreco(it.id, f.id, e.target.value)}
                        />
                        <span className="field-hint" style={{ minWidth: 90, textAlign: 'right' }}>
                          {preco != null && it.quantidade > 0 ? formatBRL(preco * it.quantidade) : ''}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>

          {Object.keys(totais.porFornecedor).length > 0 && (
            <div className="manage-row" style={{ display: 'block', marginTop: 16 }}>
              <strong>Resumo da escolha</strong>
              {estado.fornecedores
                .filter((f) => totais.porFornecedor[f.id] != null)
                .map((f) => (
                  <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>
                      {f.nome} ({estado.itens.filter((it) => it.escolhidoId === f.id).length} {estado.itens.filter((it) => it.escolhidoId === f.id).length === 1 ? 'produto' : 'produtos'})
                    </span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatBRL(totais.porFornecedor[f.id])}</span>
                  </div>
                ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <strong>Total</strong>
                <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatBRL(totais.total)}</strong>
              </div>
              {totais.economia > 0 && <span className="field-hint">Economia contra o fornecedor mais caro de cada produto: {formatBRL(totais.economia)}</span>}
            </div>
          )}

          {erro && <p className="login-error">{erro}</p>}

          {!somenteLeitura && (
            <>
              <div className="field" style={{ marginTop: 16 }}>
                <label>Data de entrega prevista dos pedidos</label>
                <input type="date" value={dataEntrega} onChange={(e) => setDataEntrega(e.target.value)} style={{ maxWidth: 180 }} />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <button type="button" className="btn btn-ghost" disabled={ocupado || estado.itens.length === 0} onClick={copiarPedido}>
                  Copiar lista para pedir preço
                </button>
                <button type="button" className="btn btn-ghost" disabled={ocupado} onClick={() => { setManuais(new Set()); mudar(escolherMaisBarato) }}>
                  Escolher o mais barato em tudo
                </button>
              </div>
            </>
          )}
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={fechar}>
              {somenteLeitura ? 'Fechar' : 'Cancelar'}
            </button>
            {!somenteLeitura && (
              <>
                <button type="button" className="btn btn-ghost" disabled={ocupado} onClick={salvar}>
                  Salvar rascunho
                </button>
                <button type="button" className="btn btn-primary" disabled={ocupado} onClick={gerar}>
                  {ocupado ? 'Aguarde...' : 'Gerar pedidos'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
