import { useMemo, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isFullAdmin, useAuthStore } from '../../store/authStore'
import { visibleCategorias } from './estoqueAccess'
import {
  ESTOQUE_CONDICOES_ARMAZENAMENTO,
  ESTOQUE_TIPOS_PRODUTO,
  ESTOQUE_UNIDADES_PRODUTO,
  UNIDADES_VALIDADE,
} from './estoqueConstants'
import {
  ESTOQUE_ITENS_KEY,
  TAXONOMIAS_KEY,
  criarProdutoEstoque,
  registrarTaxonomia,
  taxonomiaValores,
  useEstoqueItens,
  useFichasProducaoOptions,
  useTaxonomias,
} from './useEstoque'
import type {
  EstoqueCategoria,
  EstoqueCondicaoArmazenamento,
  EstoqueTipoProduto,
  EstoqueUnidade,
  UnidadeValidade,
} from '../../types/database'

export function EstoqueCadastrarProdutoTab() {
  const profile = useAuthStore((s) => s.profile)
  const queryClient = useQueryClient()
  const setores = visibleCategorias(profile)
  // Mesma trava de setor das outras abas: Administrador escolhe livre,
  // qualquer outro perfil fica preso ao próprio setor.
  const locked = isFullAdmin(profile) ? null : (profile?.setor ?? null)

  const [setor, setSetor] = useState<EstoqueCategoria>((locked as EstoqueCategoria | null) ?? setores[0] ?? 'Bar')
  const [tipoProduto, setTipoProduto] = useState<EstoqueTipoProduto>('Matéria Prima')
  const [nome, setNome] = useState('')
  const [marca, setMarca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [subcategoria, setSubcategoria] = useState('')
  const [unidade, setUnidade] = useState<EstoqueUnidade>('Unidade')
  const [volumePadrao, setVolumePadrao] = useState('')
  const [condicaoArmazenamento, setCondicaoArmazenamento] = useState<EstoqueCondicaoArmazenamento | ''>('')
  const [prazoValidade, setPrazoValidade] = useState('')
  const [unidadeValidade, setUnidadeValidade] = useState<UnidadeValidade>('Dias')
  const [fichaProducaoId, setFichaProducaoId] = useState('')
  const [pendingCategoria, setPendingCategoria] = useState<string[]>([])
  const [pendingSubcategoria, setPendingSubcategoria] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { data: itens } = useEstoqueItens()
  const { data: taxonomias } = useTaxonomias('estoque')
  const isRemanufaturado = tipoProduto === 'Remanufaturado'
  const { data: fichasProducao } = useFichasProducaoOptions(isRemanufaturado ? setor : null)

  const itensDoSetor = useMemo(() => (itens ?? []).filter((it) => it.categoria === setor), [itens, setor])
  const categoriaOptions = useMemo(
    () => Array.from(new Set([...taxonomiaValores(taxonomias ?? [], setor, 'categoria'), ...pendingCategoria])),
    [taxonomias, setor, pendingCategoria],
  )
  const subcategoriaOptions = useMemo(
    () => Array.from(new Set([...taxonomiaValores(taxonomias ?? [], setor, 'subcategoria'), ...pendingSubcategoria])),
    [taxonomias, setor, pendingSubcategoria],
  )

  function resetSetorDependente(next: EstoqueCategoria) {
    setSetor(next)
    setCategoria('')
    setSubcategoria('')
    setFichaProducaoId('')
    setPendingCategoria([])
    setPendingSubcategoria([])
  }

  async function handleAddCategoria(valor: string) {
    setPendingCategoria((p) => [...p, valor])
    setCategoria(valor)
    try {
      await registrarTaxonomia('estoque', setor, valor, '')
      await queryClient.invalidateQueries({ queryKey: TAXONOMIAS_KEY('estoque') })
    } catch {
      // A opção já fica utilizável localmente (pendingCategoria); só a
      // sugestão pra próxima vez que falha silenciosamente aqui.
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

  const nomeJaExiste = useMemo(
    () => itensDoSetor.some((it) => it.title.toLowerCase() === nome.trim().toLowerCase()),
    [itensDoSetor, nome],
  )
  const isValid = !!setor && !!nome.trim() && !!unidade && !!condicaoArmazenamento && !nomeJaExiste

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isValid) return
    setError(null)
    setSuccess(null)
    if (!condicaoArmazenamento) return
    setSubmitting(true)
    try {
      await criarProdutoEstoque({
        categoria: setor,
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
      setSuccess(`Produto "${nome.trim()}" cadastrado.`)
      setNome('')
      setMarca('')
      setCategoria('')
      setSubcategoria('')
      setVolumePadrao('')
      setCondicaoArmazenamento('')
      setPrazoValidade('')
      setUnidadeValidade('Dias')
      setFichaProducaoId('')
      setPendingCategoria([])
      setPendingSubcategoria([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar produto.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h3 className="page-title" style={{ marginBottom: 4 }}>
        Cadastrar Produto
      </h3>
      <p className="page-subtitle" style={{ marginBottom: 16 }}>
        Cadastro base do produto — usado por Entrada, Retirada, Estoque Mínimo/Máximo e Lista de Compras.
      </p>
      <form className="modal-body" onSubmit={handleSubmit} style={{ maxWidth: 560 }}>
        <div className="field">
          <label>Setor do produto *</label>
          <select
            value={setor}
            onChange={(e) => resetSetorDependente(e.target.value as EstoqueCategoria)}
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
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex.: Bourbon" required />
            {nomeJaExiste && <span className="field-hint">Já existe um produto com esse nome neste setor.</span>}
          </div>
          <div className="field">
            <label>Marca</label>
            <input
              value={marca}
              onChange={(e) => setMarca(e.target.value.toUpperCase())}
              placeholder="ex.: JIM BEAM WHITE"
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
            <input
              type="number"
              min="0"
              step="any"
              value={volumePadrao}
              onChange={(e) => setVolumePadrao(e.target.value)}
              placeholder="ex.: 1"
            />
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
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={prazoValidade}
                  onChange={(e) => setPrazoValidade(e.target.value)}
                  placeholder="ex.: 5"
                />
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
              {(fichasProducao ?? []).length === 0 && (
                <span className="field-hint">Nenhuma ficha de produção publicada neste setor ainda.</span>
              )}
            </div>
          </>
        )}

        {error && <p className="login-error">{error}</p>}
        {success && <p className="form-success">{success}</p>}
        <button type="submit" className="btn btn-primary" disabled={!isValid || submitting}>
          {submitting ? 'Cadastrando...' : 'Cadastrar produto'}
        </button>
      </form>
    </div>
  )
}

// Select de valor controlado (categoria/subcategoria), com um botão pequeno
// ao lado pra registrar um valor novo na tabela de sugestões (taxonomias) e
// já deixá-lo selecionado — pedido explícito do usuário ("botão pequeno ao
// lado: adicionar categoria/subcategoria"), diferente do padrão de
// input+datalist livre usado na aba Entrada.
function TaxonomiaField({
  label,
  valor,
  onChange,
  opcoes,
  onAdd,
  addTitle,
  placeholder,
}: {
  label: string
  valor: string
  onChange: (v: string) => void
  opcoes: string[]
  onAdd: (v: string) => void
  addTitle: string
  placeholder: string
}) {
  const [adding, setAdding] = useState(false)
  const [novo, setNovo] = useState('')

  function confirmAdd() {
    const v = novo.trim()
    if (!v) return
    onAdd(v)
    setNovo('')
    setAdding(false)
  }

  return (
    <div className="field">
      <label>{label}</label>
      {adding ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            placeholder={placeholder}
            autoFocus
            style={{ flex: 1 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                confirmAdd()
              }
              if (e.key === 'Escape') {
                setAdding(false)
                setNovo('')
              }
            }}
          />
          <button type="button" className="icon-btn" title="Confirmar" onClick={confirmAdd}>
            ✓
          </button>
          <button
            type="button"
            className="icon-btn"
            title="Cancelar"
            onClick={() => {
              setAdding(false)
              setNovo('')
            }}
          >
            ✕
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={valor} onChange={(e) => onChange(e.target.value)} style={{ flex: 1 }}>
            <option value="">Selecione...</option>
            {opcoes.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <button type="button" className="icon-btn" title={addTitle} onClick={() => setAdding(true)}>
            +
          </button>
        </div>
      )}
    </div>
  )
}
