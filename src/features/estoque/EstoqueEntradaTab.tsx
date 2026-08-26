import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isFullAdmin, useAuthStore } from '../../store/authStore'
import { isoDate } from '../../lib/date'
import { supabase } from '../../lib/supabaseClient'
import { visibleCategorias } from './estoqueAccess'
import { ESTOQUE_UNIDADES_ENTRADA } from './estoqueConstants'
import {
  ESTOQUE_ITENS_KEY,
  ESTOQUE_MOVIMENTOS_KEY,
  TAXONOMIAS_KEY,
  findOrCreateEstoqueItem,
  registrarTaxonomia,
  taxonomiaValores,
  useEstoqueItens,
  useTaxonomias,
} from './useEstoque'
import type { EstoqueCategoria, EstoqueUnidade } from '../../types/database'

export function EstoqueEntradaTab() {
  const profile = useAuthStore((s) => s.profile)
  const queryClient = useQueryClient()
  const { data: itens } = useEstoqueItens()
  const { data: taxonomias } = useTaxonomias('estoque')
  const setores = visibleCategorias(profile)
  // Só Administrador escolhe setor livremente — qualquer outro perfil
  // (gestor ou funcionário comum) fica travado no próprio setor.
  const locked = isFullAdmin(profile) ? null : (profile?.setor ?? null)

  const [setor, setSetor] = useState<EstoqueCategoria>(locked ?? setores[0] ?? 'Bar')
  const [produto, setProduto] = useState('')
  const [categoria, setCategoria] = useState('')
  const [subcategoria, setSubcategoria] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [unidade, setUnidade] = useState<EstoqueUnidade>('Unidade')
  const [data, setData] = useState(isoDate(new Date()))
  const [validade, setValidade] = useState('')
  const [observacao, setObservacao] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const itensDoSetor = useMemo(() => (itens ?? []).filter((it) => it.categoria === setor), [itens, setor])
  const produtoOptions = useMemo(() => itensDoSetor.map((it) => it.title), [itensDoSetor])
  const categoriaOptions = useMemo(() => taxonomiaValores(taxonomias ?? [], setor, 'categoria'), [taxonomias, setor])
  const subcategoriaOptions = useMemo(
    () => taxonomiaValores(taxonomias ?? [], setor, 'subcategoria'),
    [taxonomias, setor],
  )

  // Ao identificar que o nome digitado já é um produto existente nesse
  // setor, pré-preenche categoria/subcategoria com a classificação atual
  // dele (a última vez que foi cadastrado/ajustado) — só quando bate exato
  // (case-insensitive), pra não sujar o que o usuário está digitando pra um
  // produto genuinamente novo.
  useEffect(() => {
    const match = itensDoSetor.find((it) => it.title.toLowerCase() === produto.trim().toLowerCase())
    if (match) {
      setCategoria(match.produto_categoria ?? '')
      setSubcategoria(match.subcategoria ?? '')
      setUnidade(match.unidade)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produto, itensDoSetor])

  const quantidadeNum = Number(quantidade)
  const isValid = !!setor && !!produto.trim() && quantidadeNum > 0 && !!unidade && !!data

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isValid || !profile) return
    setError(null)
    setSubmitting(true)
    try {
      const item = await findOrCreateEstoqueItem(
        setor,
        produto,
        unidade,
        categoria.trim() || null,
        subcategoria.trim() || null,
      )
      await registrarTaxonomia('estoque', setor, categoria, subcategoria)

      // "Dar Entrada" só guarda data (sem hora própria no protótipo) —
      // mantemos a hora atual pra dar uma ordenação sensata entre lançamentos
      // do mesmo dia, mas quem manda na DATA é sempre o campo escolhido.
      const now = new Date()
      const [y, m, d] = data.split('-').map(Number)
      const dataHora = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds()).toISOString()

      const { error: rpcError } = await supabase.rpc('registrar_entrada_estoque', {
        p_item_id: item.id,
        p_quantidade: quantidadeNum,
        p_tipo: 'Entrada Manual',
        p_data_hora: dataHora,
        p_validade: validade || null,
        p_observacao: observacao.trim() || null,
      })
      if (rpcError) {
        setError(rpcError.message)
        return
      }

      await queryClient.invalidateQueries({ queryKey: ESTOQUE_ITENS_KEY })
      await queryClient.invalidateQueries({ queryKey: ESTOQUE_MOVIMENTOS_KEY })
      await queryClient.invalidateQueries({ queryKey: TAXONOMIAS_KEY('estoque') })
      setProduto('')
      setCategoria('')
      setSubcategoria('')
      setQuantidade('')
      setValidade('')
      setObservacao('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h3 className="page-title" style={{ marginBottom: 16 }}>
        Entrada no Estoque
      </h3>
      <form className="modal-body" onSubmit={handleSubmit} style={{ maxWidth: 520 }}>
        <div className="field">
          <label>Setor *</label>
          <select
            value={setor}
            onChange={(e) => {
              setSetor(e.target.value as EstoqueCategoria)
              setProduto('')
              setCategoria('')
              setSubcategoria('')
            }}
            disabled={!!locked}
          >
            {(locked ? [locked] : setores).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Nome do produto *</label>
          <input value={produto} onChange={(e) => setProduto(e.target.value)} list="entrada-produto-list" required />
          <datalist id="entrada-produto-list">
            {produtoOptions.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Categoria</label>
            <input value={categoria} onChange={(e) => setCategoria(e.target.value)} list="entrada-categoria-list" />
            <datalist id="entrada-categoria-list">
              {categoriaOptions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="field">
            <label>Subcategoria</label>
            <input
              value={subcategoria}
              onChange={(e) => setSubcategoria(e.target.value)}
              list="entrada-subcategoria-list"
            />
            <datalist id="entrada-subcategoria-list">
              {subcategoriaOptions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Quantidade *</label>
            <input
              type="number"
              min="0.001"
              step="any"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Unidade de medida *</label>
            <select value={unidade} onChange={(e) => setUnidade(e.target.value as EstoqueUnidade)}>
              {ESTOQUE_UNIDADES_ENTRADA.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Data da entrada *</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
          </div>
          <div className="field">
            <label>Data de validade (opcional)</label>
            <input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Responsável pela entrada</label>
          <input value={profile?.nome ?? ''} disabled />
        </div>
        <div className="field">
          <label>Observação (opcional)</label>
          <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} />
        </div>
        {error && <p className="login-error">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={!isValid || submitting}>
          {submitting ? 'Registrando...' : 'Registrar entrada'}
        </button>
      </form>
    </div>
  )
}
