import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { confirmar } from '../../store/confirmStore'
import { visibleCategorias } from './estoqueAccess'
import {
  ESTOQUE_ITENS_KEY,
  TAXONOMIAS_KEY,
  excluirTaxonomia,
  reatribuirCategoriaPai,
  registrarTaxonomia,
  renomearTaxonomia,
  soltarSubcategoriasDe,
  useEstoqueItens,
  useTaxonomias,
} from './useEstoque'
import type { EstoqueCategoria, TaxonomiaRow } from '../../types/database'

const SEM_PAI = '__sem_pai__'

// Pedido do usuário: apagar/editar categorias e subcategorias de produto, e
// vincular cada subcategoria a uma categoria (ao escolher "Bebidas
// alcoólicas" só aparecem Destilada/Amari/Licores). Categorias/subcategorias
// são sugestões (tabela taxonomias) — apagar não altera produto nenhum, o
// valor segue gravado nos que já usavam. Só o Administrador exclui/renomeia
// (RLS). Aberto a partir de Cadastrar Produto.
export function GerenciarTaxonomiasModal({ onClose }: { onClose: () => void }) {
  const profile = useAuthStore((s) => s.profile)
  const queryClient = useQueryClient()
  const setores = visibleCategorias(profile)
  const [setor, setSetor] = useState<EstoqueCategoria>(setores[0] ?? 'Bar')
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [novoValor, setNovoValor] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [novaSubPorPai, setNovaSubPorPai] = useState<Record<string, string>>({})

  const { data: taxonomias } = useTaxonomias('estoque')
  const { data: itens } = useEstoqueItens()

  const doSetor = useMemo(
    () =>
      (taxonomias ?? [])
        .filter((t) => t.setor === setor)
        .sort((a, b) => a.tipo.localeCompare(b.tipo) || a.valor.localeCompare(b.valor, 'pt-BR')),
    [taxonomias, setor],
  )
  const categorias = doSetor.filter((t) => t.tipo === 'categoria')
  const subcategorias = doSetor.filter((t) => t.tipo === 'subcategoria')
  const subSemPai = subcategorias.filter((t) => t.categoria_pai == null)

  function invalidarTudo() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: TAXONOMIAS_KEY('estoque') }),
      queryClient.invalidateQueries({ queryKey: ESTOQUE_ITENS_KEY }),
    ])
  }

  function contagem(t: TaxonomiaRow): number {
    return (itens ?? []).filter((it) => {
      if (it.categoria !== setor) return false
      if (t.tipo === 'categoria') return it.produto_categoria === t.valor
      if (it.subcategoria !== t.valor) return false
      // subcategoria vinculada: conta só os produtos da categoria mãe
      return t.categoria_pai == null || it.produto_categoria === t.categoria_pai
    }).length
  }

  function iniciarEdicao(t: TaxonomiaRow) {
    setEditandoId(t.id)
    setNovoValor(t.valor)
  }

  async function handleRenomear(t: TaxonomiaRow) {
    const alvo = novoValor.trim()
    if (!alvo || alvo === t.valor) {
      setEditandoId(null)
      return
    }
    const jaExiste = doSetor.some(
      (o) => o.tipo === t.tipo && o.id !== t.id && o.categoria_pai === t.categoria_pai && o.valor.toLowerCase() === alvo.toLowerCase(),
    )
    const aviso = jaExiste ? ` Já existe "${alvo}" — os dois vão virar um só.` : ''
    if (!(await confirmar(`Renomear a ${t.tipo} "${t.valor}" para "${alvo}"?${aviso} Os produtos de ${setor} que usam "${t.valor}" passam a usar "${alvo}".`)))
      return
    setSalvando(true)
    try {
      await renomearTaxonomia(t.id, alvo)
      await invalidarTudo()
      setEditandoId(null)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Erro ao renomear.')
    } finally {
      setSalvando(false)
    }
  }

  async function handleExcluir(t: TaxonomiaRow) {
    const n = contagem(t)
    const avisoProdutos =
      n > 0 ? ` ${n} produto(s) continuam com "${t.valor}" — eles não mudam, o valor só deixa de ser sugerido.` : ''
    const filhas = t.tipo === 'categoria' ? subcategorias.filter((s) => s.categoria_pai === t.valor).length : 0
    const avisoFilhas = filhas > 0 ? ` ${filhas} subcategoria(s) ligada(s) a ela ficam sem categoria.` : ''
    if (!(await confirmar(`Excluir a ${t.tipo} "${t.valor}" de ${setor}?${avisoProdutos}${avisoFilhas}`))) return
    setExcluindoId(t.id)
    try {
      if (t.tipo === 'categoria' && filhas > 0) await soltarSubcategoriasDe(setor, t.valor)
      await excluirTaxonomia(t.id)
      await queryClient.invalidateQueries({ queryKey: TAXONOMIAS_KEY('estoque') })
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Erro ao excluir.')
    } finally {
      setExcluindoId(null)
    }
  }

  async function handleMoverPai(t: TaxonomiaRow, novoPai: string) {
    const alvo = novoPai === SEM_PAI ? null : novoPai
    if (alvo === (t.categoria_pai ?? null)) return
    try {
      await reatribuirCategoriaPai(t.id, alvo)
      await queryClient.invalidateQueries({ queryKey: TAXONOMIAS_KEY('estoque') })
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Erro ao mover subcategoria.')
    }
  }

  async function handleAddSub(paiValor: string | null) {
    const chave = paiValor ?? SEM_PAI
    const nome = (novaSubPorPai[chave] ?? '').trim()
    if (!nome) return
    try {
      await registrarTaxonomia('estoque', setor, '', nome, paiValor)
      setNovaSubPorPai((p) => ({ ...p, [chave]: '' }))
      await queryClient.invalidateQueries({ queryKey: TAXONOMIAS_KEY('estoque') })
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Erro ao adicionar subcategoria.')
    }
  }

  function renderEditRow(t: TaxonomiaRow) {
    return (
      <div className="manage-row" key={t.id} style={{ gap: 8 }}>
        <input
          value={novoValor}
          onChange={(e) => setNovoValor(e.target.value)}
          autoFocus
          disabled={salvando}
          style={{ flex: 1 }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void handleRenomear(t)
            }
            if (e.key === 'Escape') setEditandoId(null)
          }}
        />
        <button className="icon-btn" title="Salvar" disabled={salvando} onClick={() => void handleRenomear(t)}>
          ✓
        </button>
        <button className="icon-btn" title="Cancelar" disabled={salvando} onClick={() => setEditandoId(null)}>
          ✕
        </button>
      </div>
    )
  }

  function renderCategoriaRow(t: TaxonomiaRow) {
    if (editandoId === t.id) return renderEditRow(t)
    return (
      <div className="manage-row" key={t.id}>
        <div className="manage-row-info">
          <strong>{t.valor}</strong>
          <span>{contagem(t)} produto(s)</span>
        </div>
        <div className="manage-row-actions">
          <button className="icon-btn" title="Renomear" onClick={() => iniciarEdicao(t)}>
            ✎
          </button>
          <button
            className="icon-btn danger"
            title="Excluir"
            disabled={excluindoId === t.id}
            onClick={() => handleExcluir(t)}
          >
            🗑
          </button>
        </div>
      </div>
    )
  }

  function renderSubRow(t: TaxonomiaRow) {
    if (editandoId === t.id) return renderEditRow(t)
    return (
      <div className="manage-row" key={t.id}>
        <div className="manage-row-info">
          <strong>{t.valor}</strong>
          <span>{contagem(t)} produto(s)</span>
        </div>
        <div className="manage-row-actions" style={{ gap: 6 }}>
          <select
            value={t.categoria_pai ?? SEM_PAI}
            title="Categoria da subcategoria"
            onChange={(e) => void handleMoverPai(t, e.target.value)}
            style={{ maxWidth: 150 }}
          >
            <option value={SEM_PAI}>(sem categoria)</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.valor}>
                {c.valor}
              </option>
            ))}
          </select>
          <button className="icon-btn" title="Renomear" onClick={() => iniciarEdicao(t)}>
            ✎
          </button>
          <button
            className="icon-btn danger"
            title="Excluir"
            disabled={excluindoId === t.id}
            onClick={() => handleExcluir(t)}
          >
            🗑
          </button>
        </div>
      </div>
    )
  }

  function renderAddSub(paiValor: string | null) {
    const chave = paiValor ?? SEM_PAI
    return (
      <div className="manage-row" style={{ gap: 8 }}>
        <input
          value={novaSubPorPai[chave] ?? ''}
          placeholder="Nova subcategoria"
          style={{ flex: 1 }}
          onChange={(e) => setNovaSubPorPai((p) => ({ ...p, [chave]: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void handleAddSub(paiValor)
            }
          }}
        />
        <button className="icon-btn" title="Adicionar subcategoria" onClick={() => void handleAddSub(paiValor)}>
          +
        </button>
      </div>
    )
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>Gerenciar categorias e subcategorias</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="field" style={{ maxWidth: 240, marginBottom: 16 }}>
            <label>Setor</label>
            <select
              value={setor}
              onChange={(e) => {
                setSetor(e.target.value as EstoqueCategoria)
                setEditandoId(null)
              }}
            >
              {setores.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 18 }}>
            <h4 className="section-label">Categorias</h4>
            <div className="manage-list">
              {categorias.length === 0 && <div className="empty-state">Nenhuma cadastrada em {setor}.</div>}
              {categorias.map(renderCategoriaRow)}
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <h4 className="section-label">Subcategorias por categoria</h4>
            {categorias.length === 0 && (
              <div className="empty-state">Cadastre uma categoria primeiro para vincular subcategorias.</div>
            )}
            {categorias.map((cat) => (
              <div key={cat.id} style={{ marginBottom: 14 }}>
                <h5 style={{ margin: '0 0 6px', fontSize: '0.9rem', opacity: 0.85 }}>{cat.valor}</h5>
                <div className="manage-list">
                  {subcategorias
                    .filter((s) => s.categoria_pai === cat.valor)
                    .map(renderSubRow)}
                  {renderAddSub(cat.valor)}
                </div>
              </div>
            ))}

            {subSemPai.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <h5 style={{ margin: '0 0 6px', fontSize: '0.9rem', opacity: 0.6 }}>Sem categoria</h5>
                <div className="manage-list">{subSemPai.map(renderSubRow)}</div>
              </div>
            )}
          </div>

          <p className="field-hint">
            Cada subcategoria fica ligada a uma categoria — no cadastro de produto, ao escolher a categoria só aparecem as
            subcategorias dela. Renomear (✎) também atualiza os produtos de {setor} que usam o valor. Apagar (🗑) remove só
            da lista de sugestões — os produtos que já usam continuam iguais.
          </p>

          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose}>
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
