import { formatDateBR, isoDate } from '../../lib/date'
import {
  agruparPorCampo,
  estoqueItemCritico,
  estoqueQuantidadeLabel,
  formatValidadeRotulo,
  ordenarPorTitulo,
  validadeInfo,
  validadeProxima,
} from './estoqueHelpers'
import type { EstoqueItemRow } from '../../types/database'

const todayIso = isoDate(new Date())

// Lista de leitura do saldo, sempre Setor > Categoria > Subcategoria (nessa
// ordem) — reaproveitada tanto pela aba "Estoque" quanto pelo painel de
// referência da aba "Retirada". `showSetor` controla só se o primeiro nível
// (Setor) é renderizado — quando a tela já está travada num único setor, não
// faz sentido repetir esse nível.
export function EstoqueItemList({
  itens,
  showSetor,
  search,
}: {
  itens: EstoqueItemRow[]
  showSetor: boolean
  search?: string
}) {
  const termo = search?.trim().toLowerCase()
  const filtrados = termo ? itens.filter((it) => it.title.toLowerCase().includes(termo)) : itens

  if (filtrados.length === 0) {
    return <div className="empty-state">Nenhum produto encontrado.</div>
  }

  if (showSetor) {
    const porSetor = agruparPorCampo(filtrados, (it) => it.categoria, '—')
    return (
      <>
        {porSetor.map((grupoSetor) => (
          <div key={grupoSetor.chave} style={{ marginBottom: 24 }}>
            <h3 className="section-label">{grupoSetor.chave}</h3>
            <CategoriaSubcategoriaGrupos itens={grupoSetor.itens} />
          </div>
        ))}
      </>
    )
  }

  return <CategoriaSubcategoriaGrupos itens={filtrados} />
}

function CategoriaSubcategoriaGrupos({ itens }: { itens: EstoqueItemRow[] }) {
  const porCategoria = agruparPorCampo(itens, (it) => it.produto_categoria, 'Sem categoria')
  return (
    <>
      {porCategoria.map((grupoCategoria) => {
        const porSubcategoria = agruparPorCampo(grupoCategoria.itens, (it) => it.subcategoria, 'Sem subcategoria')
        return (
          <div key={grupoCategoria.chave} style={{ marginBottom: 20 }}>
            <h4 className="section-label">{grupoCategoria.chave}</h4>
            {porSubcategoria.map((grupoSub) => (
              <div key={grupoSub.chave} style={{ marginBottom: 10 }}>
                {porSubcategoria.length > 1 && (
                  <div className="task-meta" style={{ marginBottom: 6 }}>
                    {grupoSub.chave}
                  </div>
                )}
                <div className="manage-list">
                  {ordenarPorTitulo(grupoSub.itens).map((item) => (
                    <EstoqueItemRowView key={item.id} item={item} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </>
  )
}

function EstoqueItemRowView({ item }: { item: EstoqueItemRow }) {
  const critico = estoqueItemCritico(item)
  const proximaValidade = validadeProxima(item, todayIso)
  const rotulo = item.validade ? formatValidadeRotulo(validadeInfo(item.validade, todayIso)) : null

  return (
    <div className={`manage-row ${critico ? 'content-row-critico' : ''}`}>
      <div className="manage-row-info">
        <strong>{item.title}</strong>
        <span>
          {estoqueQuantidadeLabel(item.quantidade, item.unidade)} em estoque · {item.categoria}
          {item.validade ? ` · Validade: ${formatDateBR(item.validade)}` : ''}
        </span>
        <div className="account-badges">
          {critico && <span className="badge-critico">Crítico</span>}
          {proximaValidade && (
            <span className={`badge-status ${rotulo === 'vencido' ? 'badge-status-bloqueada' : 'badge-status-pendente'}`}>
              {rotulo}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
