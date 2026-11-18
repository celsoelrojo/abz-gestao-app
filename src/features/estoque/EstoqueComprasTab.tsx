import { useMemo, useState } from 'react'
import { isFullAdmin, useAuthStore } from '../../store/authStore'
import { CotacaoEditor } from './CotacaoEditor'
import { itemDeCotacao, novaCotacaoVazia, tituloPadrao, type CotacaoEstado } from './cotacaoHelpers'
import { visibleCategorias } from './estoqueAccess'
import { agruparPorCampo, estoqueQuantidadeLabel, ordenarPorTitulo, precisaComprar, sugestaoCompra } from './estoqueHelpers'
import { useEstoqueItens } from './useEstoque'

// 100% derivada do saldo médio configurado — nunca escreve no Estoque Atual,
// só reflete o saldo até uma entrada real ser registrada em "Dar Entrada no
// Estoque" (mesmo comportamento do protótipo — não existe "marcar como
// comprado" nem cadastro manual de item nesta lista). Administração marca os
// produtos e abre uma cotação com eles ("Cotar selecionados").
export function EstoqueComprasTab() {
  const profile = useAuthStore((s) => s.profile)
  const podeCotar = isFullAdmin(profile)
  const setores = visibleCategorias(profile)
  const { data: itens, isLoading } = useEstoqueItens()
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [cotacao, setCotacao] = useState<CotacaoEstado | null>(null)

  const sugeridos = useMemo(
    () => (itens ?? []).filter((it) => setores.includes(it.categoria) && precisaComprar(it)),
    [itens, setores],
  )
  const grupos = useMemo(() => agruparPorCampo(sugeridos, (it) => it.produto_categoria, 'Sem categoria'), [sugeridos])

  if (isLoading) return <div className="empty-state">Carregando…</div>

  function alternar(id: string) {
    setSelecionados((s) => {
      const novo = new Set(s)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  function cotarSelecionados() {
    const escolhidos = sugeridos.filter((it) => selecionados.has(it.id))
    setCotacao({ ...novaCotacaoVazia(), titulo: tituloPadrao(), itens: escolhidos.map((it) => itemDeCotacao(it, sugestaoCompra(it))) })
  }

  const todosMarcados = sugeridos.length > 0 && sugeridos.every((it) => selecionados.has(it.id))

  return (
    <div>
      <h3 className="page-title" style={{ marginBottom: 16 }}>
        Lista de Compras
      </h3>
      {podeCotar && sugeridos.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          <button type="button" className="btn btn-ghost" onClick={() => setSelecionados(todosMarcados ? new Set() : new Set(sugeridos.map((it) => it.id)))}>
            {todosMarcados ? 'Limpar seleção' : 'Selecionar todos'}
          </button>
          <button type="button" className="btn btn-primary" disabled={selecionados.size === 0} onClick={cotarSelecionados}>
            Cotar selecionados ({selecionados.size})
          </button>
        </div>
      )}
      {grupos.length === 0 && <div className="empty-state">Nenhum produto abaixo do estoque médio configurado.</div>}
      {grupos.map((grupo) => (
        <div key={grupo.chave} style={{ marginBottom: 20 }}>
          <h4 className="section-label">{grupo.chave}</h4>
          <div className="manage-list">
            {ordenarPorTitulo(grupo.itens).map((item) => {
              const sugestao = sugestaoCompra(item)
              return (
                <div className="manage-row" key={item.id}>
                  {podeCotar && (
                    <input type="checkbox" checked={selecionados.has(item.id)} onChange={() => alternar(item.id)} aria-label={`Cotar ${item.title}`} />
                  )}
                  <div className="manage-row-info">
                    <strong>{item.title}</strong>
                    <span>
                      Atual: {estoqueQuantidadeLabel(item.quantidade, item.unidade)} · Médio:{' '}
                      {estoqueQuantidadeLabel(Number(item.medio), item.unidade)} · Sugestão de compra (80% do máximo):{' '}
                      {sugestao == null ? 'configure o estoque máximo' : estoqueQuantidadeLabel(sugestao, item.unidade)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {cotacao && <CotacaoEditor inicial={cotacao} onClose={() => setCotacao(null)} />}
    </div>
  )
}
