import { useMemo, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isFullAdmin, useAuthStore } from '../../store/authStore'
import { isoDate } from '../../lib/date'
import { supabase } from '../../lib/supabaseClient'
import { visibleCategorias } from './estoqueAccess'
import { ordenarPorTitulo } from './estoqueHelpers'
import { ESTOQUE_ITENS_KEY, ESTOQUE_MOVIMENTOS_KEY, useEstoqueItens } from './useEstoque'
import type { EstoqueCategoria } from '../../types/database'

// Pedido do usuário: só 6 campos (Setor, Nome do produto, Quantidade, Data de
// entrada, Responsável, Observação), e o produto tem que ser um já cadastrado
// em "Cadastrar Produto" — não dá mais pra CRIAR um nome novo aqui (por isso
// Categoria/Subcategoria/Unidade somem deste formulário: já vêm do cadastro
// do produto, não precisam ser perguntadas de novo a cada entrada). Mas
// continua dando pra DIGITAR o nome — input com <datalist> (mesmo padrão já
// usado em Categoria/Subcategoria e no protótipo) vai sugerindo os produtos
// já cadastrados nesse setor à medida que o usuário digita; só que agora só
// resolve pra um produto de verdade (e libera o Enviar) quando o texto bate
// exatamente com um nome cadastrado — não cria mais nada na hora.
export function EstoqueEntradaTab({ onIrParaCadastro }: { onIrParaCadastro?: () => void }) {
  const profile = useAuthStore((s) => s.profile)
  const queryClient = useQueryClient()
  const { data: itens } = useEstoqueItens()
  const setores = visibleCategorias(profile)
  // Só Administrador escolhe setor livremente — qualquer outro perfil
  // (gestor ou funcionário comum) fica travado no próprio setor.
  const locked = isFullAdmin(profile) ? null : (profile?.setor ?? null)

  const [setor, setSetor] = useState<EstoqueCategoria>(locked ?? setores[0] ?? 'Bar')
  const [produtoTexto, setProdutoTexto] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [data, setData] = useState(isoDate(new Date()))
  const [observacao, setObservacao] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const itensDoSetor = useMemo(
    () => ordenarPorTitulo((itens ?? []).filter((it) => it.categoria === setor)),
    [itens, setor],
  )
  const produtoSelecionado = useMemo(
    () => itensDoSetor.find((it) => it.title.toLowerCase() === produtoTexto.trim().toLowerCase()) ?? null,
    [itensDoSetor, produtoTexto],
  )

  const quantidadeNum = Number(quantidade)
  const isValid = !!setor && !!produtoSelecionado && quantidadeNum > 0 && !!data

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isValid) return
    setError(null)
    setSubmitting(true)
    try {
      // "Dar Entrada" só guarda data (sem hora própria no protótipo) —
      // mantemos a hora atual pra dar uma ordenação sensata entre lançamentos
      // do mesmo dia, mas quem manda na DATA é sempre o campo escolhido.
      const now = new Date()
      const [y, m, d] = data.split('-').map(Number)
      const dataHora = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds()).toISOString()

      const { error: rpcError } = await supabase.rpc('registrar_entrada_estoque', {
        p_item_id: produtoSelecionado!.id,
        p_quantidade: quantidadeNum,
        p_tipo: 'Entrada Manual',
        p_data_hora: dataHora,
        p_observacao: observacao.trim() || null,
      })
      if (rpcError) {
        setError(rpcError.message)
        return
      }

      await queryClient.invalidateQueries({ queryKey: ESTOQUE_ITENS_KEY })
      await queryClient.invalidateQueries({ queryKey: ESTOQUE_MOVIMENTOS_KEY })
      setProdutoTexto('')
      setQuantidade('')
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
              setProdutoTexto('')
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
          {itensDoSetor.length === 0 ? (
            <div className="empty-state" style={{ textAlign: 'left', padding: '10px 0' }}>
              Nenhum produto cadastrado em {setor} ainda.
              {onIrParaCadastro && (
                <div style={{ marginTop: 8 }}>
                  <button type="button" className="btn btn-ghost" onClick={onIrParaCadastro}>
                    Cadastrar produto
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <input
                value={produtoTexto}
                onChange={(e) => setProdutoTexto(e.target.value)}
                list="entrada-produto-list"
                placeholder="Digite pra buscar..."
                required
              />
              <datalist id="entrada-produto-list">
                {itensDoSetor.map((it) => (
                  <option key={it.id} value={it.title} />
                ))}
              </datalist>
              {produtoTexto.trim() && !produtoSelecionado && (
                <span className="field-hint">Nenhum produto cadastrado com esse nome em {setor}.</span>
              )}
            </>
          )}
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
            <label>Data de entrada *</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
          </div>
        </div>

        <div className="field">
          <label>Responsável</label>
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
