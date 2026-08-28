import { useMemo, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ESTOQUE_CONDICOES_ARMAZENAMENTO, ESTOQUE_TIPOS_PRODUTO, ESTOQUE_UNIDADES_PRODUTO, UNIDADES_VALIDADE } from './estoqueConstants'
import { TaxonomiaField } from './TaxonomiaField'
import {
  ESTOQUE_ITENS_KEY,
  TAXONOMIAS_KEY,
  atualizarProdutoEstoque,
  registrarTaxonomia,
  taxonomiaValores,
  useFichasProducaoOptions,
  useTaxonomias,
} from './useEstoque'
import type {
  EstoqueCondicaoArmazenamento,
  EstoqueItemRow,
  EstoqueTipoProduto,
  EstoqueUnidade,
  UnidadeValidade,
} from '../../types/database'

// Edição de um produto já cadastrado — mesmos campos do cadastro (ver
// EstoqueCadastrarProdutoTab), exceto Setor, que fica fixo (ver comentário em
// atualizarProdutoEstoque). Só aparece pra quem já podia editar
// estoque_itens via RLS (Administrador ou Gestor do próprio setor).
export function EditarProdutoModal({ item, onClose, onSaved }: { item: EstoqueItemRow; onClose: () => void; onSaved: () => void }) {
  const queryClient = useQueryClient()
  const setor = item.categoria

  const [tipoProduto, setTipoProduto] = useState<EstoqueTipoProduto>(item.tipo_produto)
  const [nome, setNome] = useState(item.title)
  const [marca, setMarca] = useState(item.marca ?? '')
  const [categoria, setCategoria] = useState(item.produto_categoria ?? '')
  const [subcategoria, setSubcategoria] = useState(item.subcategoria ?? '')
  const [unidade, setUnidade] = useState<EstoqueUnidade>(item.unidade)
  const [volumePadrao, setVolumePadrao] = useState(item.volume_padrao?.toString() ?? '')
  const [condicaoArmazenamento, setCondicaoArmazenamento] = useState<EstoqueCondicaoArmazenamento | ''>(
    item.condicao_armazenamento ?? '',
  )
  const [prazoValidade, setPrazoValidade] = useState(item.prazo_validade?.toString() ?? '')
  const [unidadeValidade, setUnidadeValidade] = useState<UnidadeValidade>(item.unidade_validade ?? 'Dias')
  const [fichaProducaoId, setFichaProducaoId] = useState(item.ficha_producao_id ?? '')
  const [pendingCategoria, setPendingCategoria] = useState<string[]>([])
  const [pendingSubcategoria, setPendingSubcategoria] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { data: taxonomias } = useTaxonomias('estoque')
  const isRemanufaturado = tipoProduto === 'Remanufaturado'
  const { data: fichasProducao } = useFichasProducaoOptions(isRemanufaturado ? setor : null)

  const categoriaOptions = useMemo(
    () => Array.from(new Set([...taxonomiaValores(taxonomias ?? [], setor, 'categoria'), ...pendingCategoria])),
    [taxonomias, setor, pendingCategoria],
  )
  const subcategoriaOptions = useMemo(
    () => Array.from(new Set([...taxonomiaValores(taxonomias ?? [], setor, 'subcategoria'), ...pendingSubcategoria])),
    [taxonomias, setor, pendingSubcategoria],
  )

  async function handleAddCategoria(valor: string) {
    setPendingCategoria((p) => [...p, valor])
    setCategoria(valor)
    try {
      await registrarTaxonomia('estoque', setor, valor, '')
      await queryClient.invalidateQueries({ queryKey: TAXONOMIAS_KEY('estoque') })
    } catch {
      // idem EstoqueCadastrarProdutoTab: falha silenciosa, opção já usável localmente.
    }
  }

  async function handleAddSubcategoria(valor: string) {
    setPendingSubcategoria((p) => [...p, valor])
    setSubcategoria(valor)
    try {
      await registrarTaxonomia('estoque', setor, '', valor)
      await queryClient.invalidateQueries({ queryKey: TAXONOMIAS_KEY('estoque') })
    } catch {
      // idem
    }
  }

  const isValid = !!nome.trim() && !!unidade && !!condicaoArmazenamento

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isValid || !condicaoArmazenamento) return
    setError(null)
    setSubmitting(true)
    try {
      await atualizarProdutoEstoque(item.id, {
        title: nome,
        tipoProduto,
        marca: marca.trim() || null,
        produtoCategoria: categoria.trim() || null,
        subcategoria: subcategoria.trim() || null,
        unidade,
        volumePadrao: volumePadrao === '' ? null : Number(volumePadrao),
        condicaoArmazenamento,
        prazoValidade: isRemanufaturado && prazoValidade !== '' ? Number(prazoValidade) : null,
        unidadeValidade: isRemanufaturado && prazoValidade !== '' ? unidadeValidade : null,
        fichaProducaoId: isRemanufaturado && fichaProducaoId ? fichaProducaoId : null,
      })
      await queryClient.invalidateQueries({ queryKey: ESTOQUE_ITENS_KEY })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar produto.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>Editar produto</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="field">
            <label>Setor</label>
            <input value={setor} disabled />
          </div>

          <div className="field">
            <label>Tipo de produto *</label>
            <select value={tipoProduto} onChange={(e) => setTipoProduto(e.target.value as EstoqueTipoProduto)}>
              {ESTOQUE_TIPOS_PRODUTO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Nome do produto *</label>
              <input value={nome} onChange={(e) => setNome(e.target.value)} required />
            </div>
            <div className="field">
              <label>Marca</label>
              <input
                value={marca}
                onChange={(e) => setMarca(e.target.value.toUpperCase())}
                style={{ textTransform: 'uppercase' }}
              />
            </div>
          </div>

          <div className="field-row">
            <TaxonomiaField
              label="Categoria"
              valor={categoria}
              onChange={setCategoria}
              opcoes={categoriaOptions}
              onAdd={handleAddCategoria}
              addTitle="Adicionar categoria"
              placeholder="Nova categoria"
            />
            <TaxonomiaField
              label="Subcategoria"
              valor={subcategoria}
              onChange={setSubcategoria}
              opcoes={subcategoriaOptions}
              onAdd={handleAddSubcategoria}
              addTitle="Adicionar subcategoria"
              placeholder="Nova subcategoria"
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label>Unidade de medida *</label>
              <select value={unidade} onChange={(e) => setUnidade(e.target.value as EstoqueUnidade)}>
                {ESTOQUE_UNIDADES_PRODUTO.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Volume padrão</label>
              <input type="number" min="0" step="any" value={volumePadrao} onChange={(e) => setVolumePadrao(e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>Condição de armazenamento *</label>
            <select
              value={condicaoArmazenamento}
              onChange={(e) => setCondicaoArmazenamento(e.target.value as EstoqueCondicaoArmazenamento)}
              required
            >
              <option value="" disabled>
                Selecione...
              </option>
              {ESTOQUE_CONDICOES_ARMAZENAMENTO.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {isRemanufaturado && (
            <>
              <div className="field-row">
                <div className="field">
                  <label>Prazo de validade</label>
                  <input type="number" min="0" step="any" value={prazoValidade} onChange={(e) => setPrazoValidade(e.target.value)} />
                </div>
                <div className="field">
                  <label style={{ visibility: 'hidden' }}>Unidade</label>
                  <select value={unidadeValidade} onChange={(e) => setUnidadeValidade(e.target.value as UnidadeValidade)}>
                    {UNIDADES_VALIDADE.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Ficha de preparo vinculada</label>
                <select value={fichaProducaoId} onChange={(e) => setFichaProducaoId(e.target.value)}>
                  <option value="">Nenhuma</option>
                  {(fichasProducao ?? []).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {error && <p className="login-error">{error}</p>}

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={!isValid || submitting}>
              {submitting ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
