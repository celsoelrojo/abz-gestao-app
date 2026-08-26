import { useMemo } from 'react'
import { useAuthStore } from '../../store/authStore'
import { visibleCategorias } from './estoqueAccess'
import { agruparPorCampo, estoqueQuantidadeLabel, ordenarPorTitulo, precisaComprar, sugestaoCompra } from './estoqueHelpers'
import { useEstoqueItens } from './useEstoque'

// 100% derivada do saldo médio configurado — nunca escreve no Estoque Atual,
// só reflete o saldo até uma entrada real ser registrada em "Dar Entrada no
// Estoque" (mesmo comportamento do protótipo — não existe "marcar como
// comprado" nem cadastro manual de item nesta lista).
export function EstoqueComprasTab() {
  const profile = useAuthStore((s) => s.profile)
  const setores = visibleCategorias(profile)
  const { data: itens, isLoading } = useEstoqueItens()

  const sugeridos = useMemo(
    () => (itens ?? []).filter((it) => setores.includes(it.categoria) && precisaComprar(it)),
    [itens, setores],
  )
  const grupos = useMemo(() => agruparPorCampo(sugeridos, (it) => it.produto_categoria, 'Sem categoria'), [sugeridos])

  if (isLoading) return <div className="empty-state">Carregando…</div>

  return (
    <div>
      <h3 className="page-title" style={{ marginBottom: 16 }}>
        Lista de Compras
      </h3>
      {grupos.length === 0 && <div className="empty-state">Nenhum produto abaixo do estoque médio configurado.</div>}
      {grupos.map((grupo) => (
        <div key={grupo.chave} style={{ marginBottom: 20 }}>
          <h4 className="section-label">{grupo.chave}</h4>
          <div className="manage-list">
            {ordenarPorTitulo(grupo.itens).map((item) => {
              const sugestao = sugestaoCompra(item)
              return (
                <div className="manage-row" key={item.id}>
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
    </div>
  )
}
