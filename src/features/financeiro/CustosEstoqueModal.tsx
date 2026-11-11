import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useEstoqueItens } from '../estoque/useEstoque'
import { formatCusto, formatQuantidade, itemContaNoCmv } from './cmvHelpers'
import { parseValorBR } from './contaHelpers'
import { ESTOQUE_CUSTOS_KEY, salvarCusto, useEstoqueCustos } from './useCmv'
import type { EstoqueCustoRow, EstoqueItemRow } from '../../types/database'

const paraTexto = (v: number) => String(Number(v.toFixed(4))).replace('.', ',')

// Custo por unidade do estoque de cada produto. Vem sozinho do preço da última
// nota lançada com entrada no estoque; aqui dá pra preencher os produtos
// antigos e corrigir qualquer valor.
export function CustosEstoqueModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const queryClient = useQueryClient()
  const { data: itens, isLoading } = useEstoqueItens()
  const { data: custos } = useEstoqueCustos()
  const [busca, setBusca] = useState('')
  const [soSemCusto, setSoSemCusto] = useState(false)

  const custoPorItem = useMemo(() => new Map((custos ?? []).map((c) => [c.item_id, c])), [custos])

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return (itens ?? [])
      .filter(itemContaNoCmv)
      .filter((i) => !termo || i.title.toLowerCase().includes(termo) || (i.marca ?? '').toLowerCase().includes(termo))
      .filter((i) => !soSemCusto || !custoPorItem.has(i.id))
      .sort((a, b) => {
        // Primeiro o que tem saldo e ainda não tem custo (é o que distorce o CMV).
        const peso = (i: EstoqueItemRow) => (!custoPorItem.has(i.id) && i.quantidade > 0 ? 0 : 1)
        return peso(a) - peso(b) || a.title.localeCompare(b.title)
      })
  }, [itens, busca, soSemCusto, custoPorItem])

  const semCustoComSaldo = (itens ?? []).filter((i) => itemContaNoCmv(i) && i.quantidade > 0 && !custoPorItem.has(i.id)).length

  async function aposSalvar() {
    await queryClient.invalidateQueries({ queryKey: ESTOQUE_CUSTOS_KEY })
    onSaved()
  }

  return (
    <div className="modal-overlay">
      <div className="modal modal-wide">
        <div className="modal-header">
          <h3>Custos do estoque</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p className="field-hint">
            Custo de <strong>uma unidade do estoque</strong> (um fardo, um litro, um quilo...). Quando você lança uma nota
            com entrada no estoque, o custo é atualizado sozinho com o preço pago. Produto sem custo fica fora do CMV.
            Remanufaturados (xaropes, preparos) não entram: o custo deles já está nos insumos.
          </p>
          {semCustoComSaldo > 0 && (
            <p className="field-hint" style={{ color: 'var(--gold-bright)' }}>
              {semCustoComSaldo} {semCustoComSaldo === 1 ? 'produto com saldo está' : 'produtos com saldo estão'} sem custo.
            </p>
          )}

          <div className="reserva-filters">
            <input type="text" placeholder="Buscar produto..." value={busca} onChange={(e) => setBusca(e.target.value)} />
            <button
              type="button"
              className={`btn ${soSemCusto ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setSoSemCusto((v) => !v)}
            >
              Só sem custo
            </button>
          </div>

          {isLoading && <div className="empty-state">Carregando…</div>}
          {!isLoading && lista.length === 0 && <div className="empty-state">Nenhum produto encontrado.</div>}

          <div className="manage-list">
            {lista.map((item) => (
              <LinhaCusto key={item.id} item={item} custo={custoPorItem.get(item.id)} onSaved={aposSalvar} />
            ))}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function LinhaCusto({ item, custo, onSaved }: { item: EstoqueItemRow; custo?: EstoqueCustoRow; onSaved: () => Promise<void> }) {
  const original = custo ? paraTexto(custo.custo_unitario) : ''
  const [texto, setTexto] = useState(original)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const mudou = texto.trim() !== original

  async function salvar() {
    setErro(null)
    const valor = texto.trim() ? parseValorBR(texto, 4) : null
    if (texto.trim() && (valor == null || valor < 0)) return setErro('Valor inválido.')
    setSalvando(true)
    try {
      await salvarCusto(item.id, valor)
      await onSaved()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar o custo.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="manage-row" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div className="manage-row-info">
        <strong>
          {item.title}
          {item.marca ? ` · ${item.marca}` : ''}
        </strong>
        <span>
          Saldo atual: {formatQuantidade(item.quantidade)} {item.unidade.toLowerCase()}
          {custo ? ` · ${formatCusto(custo.custo_unitario)} por ${item.unidade.toLowerCase()} (${custo.origem === 'nota' ? 'da última nota' : 'digitado'})` : ''}
        </span>
        {erro && <span className="login-error">{erro}</span>}
      </div>
      <input
        inputMode="decimal"
        placeholder={`R$ por ${item.unidade.toLowerCase()}`}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        aria-label={`Custo de ${item.title}`}
        style={{ maxWidth: 130, textAlign: 'right' }}
      />
      <button type="button" className="btn btn-primary" disabled={!mudou || salvando} onClick={salvar}>
        {salvando ? '...' : 'Salvar'}
      </button>
    </div>
  )
}
