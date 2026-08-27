import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabaseClient'
import { visibleCategorias } from './estoqueAccess'
import { agruparPorCampo, estoqueItemCritico, ordenarPorTitulo } from './estoqueHelpers'
import { ESTOQUE_ITENS_KEY, useEstoqueItens } from './useEstoque'
import type { EstoqueItemRow } from '../../types/database'

export function EstoqueLimitesTab() {
  const profile = useAuthStore((s) => s.profile)
  const setores = visibleCategorias(profile)
  const { data: itens, isLoading } = useEstoqueItens()

  const itensEscopo = useMemo(() => (itens ?? []).filter((it) => setores.includes(it.categoria)), [itens, setores])
  const grupos = useMemo(
    () => agruparPorCampo(itensEscopo, (it) => it.produto_categoria, 'Sem categoria'),
    [itensEscopo],
  )

  if (isLoading) return <div className="empty-state">Carregando…</div>

  return (
    <div>
      <h3 className="page-title" style={{ marginBottom: 16 }}>
        Estoque Mínimo e Máximo
      </h3>
      {grupos.length === 0 && <div className="empty-state">Nenhum produto cadastrado.</div>}
      {grupos.map((grupo) => (
        <div key={grupo.chave} style={{ marginBottom: 20 }}>
          <h4 className="section-label">{grupo.chave}</h4>
          <div className="manage-list">
            {ordenarPorTitulo(grupo.itens).map((item) => (
              <LimitesRow key={item.id} item={item} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function LimitesRow({ item }: { item: EstoqueItemRow }) {
  const queryClient = useQueryClient()
  const [min, setMin] = useState(item.min?.toString() ?? '')
  const [medio, setMedio] = useState(item.medio?.toString() ?? '')
  const [max, setMax] = useState(item.max?.toString() ?? '')
  const [saving, setSaving] = useState(false)

  const dirty = min !== (item.min?.toString() ?? '') || medio !== (item.medio?.toString() ?? '') || max !== (item.max?.toString() ?? '')

  async function handleSave() {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('estoque_itens')
        .update({
          min: min === '' ? null : Number(min),
          medio: medio === '' ? null : Number(medio),
          max: max === '' ? null : Number(max),
        })
        .eq('id', item.id)
      if (error) {
        window.alert(error.message)
        return
      }
      await queryClient.invalidateQueries({ queryKey: ESTOQUE_ITENS_KEY })
    } finally {
      setSaving(false)
    }
  }

  const critico = estoqueItemCritico({ min: min === '' ? null : Number(min), quantidade: item.quantidade })

  return (
    <div className={`manage-row ${critico ? 'content-row-critico' : ''}`}>
      <div className="manage-row-info">
        <strong>{item.title}</strong>
        <span>Saldo atual: {item.quantidade}</span>
        {critico && (
          <div className="account-badges">
            <span className="badge-critico">Crítico</span>
          </div>
        )}
      </div>
      <div className="field-row" style={{ flex: 2 }}>
        <div className="field">
          <label>Mínimo</label>
          <input type="number" min="0" step="any" value={min} onChange={(e) => setMin(e.target.value)} />
        </div>
        <div className="field">
          <label>Médio</label>
          <input type="number" min="0" step="any" value={medio} onChange={(e) => setMedio(e.target.value)} />
        </div>
        <div className="field">
          <label>Máximo</label>
          <input type="number" min="0" step="any" value={max} onChange={(e) => setMax(e.target.value)} />
        </div>
        <div className="field">
          <label style={{ visibility: 'hidden' }}>Salvar</label>
          <button className="btn btn-primary" disabled={!dirty || saving} onClick={handleSave}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
