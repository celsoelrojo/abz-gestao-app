import { useEffect, useState } from 'react'
import { calcFichaCustos, calcIngredienteCustoTotal, calcIngredienteCustoUnitario } from './fichaHelpers'
import { fichaImagemUrl } from './fichaStorage'
import type { FichaTecnicaRow, FichaTecnicaSemCustoRow } from '../../types/database'

type FichaLike = FichaTecnicaRow | FichaTecnicaSemCustoRow

export function FichaTecnicaDetailModal({ ficha, onClose }: { ficha: FichaLike; onClose: () => void }) {
  const temCusto = 'preco_sugerido' in ficha
  const custos = temCusto
    ? calcFichaCustos((ficha as FichaTecnicaRow).ingredientes, (ficha as FichaTecnicaRow).embalagem, (ficha as FichaTecnicaRow).preco_sugerido)
    : null

  // O componente é remontado por `key={ficha.id}` no chamador — evita o
  // padrão de "resetar estado no efeito" (o estado inicial null já cobre a
  // troca de ficha; só falta buscar a signed URL quando houver foto).
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!ficha.foto_principal_url) return
    let active = true
    fichaImagemUrl(ficha.foto_principal_url).then((url) => {
      if (active) setFotoUrl(url)
    })
    return () => {
      active = false
    }
  }, [ficha.foto_principal_url])

  return (
    <div className="modal-overlay">
      <div className="modal modal-wide">
        <div className="modal-header">
          <h3>{ficha.nome}</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="account-badges" style={{ marginBottom: 12 }}>
            <span className="badge-status badge-status-ativa">{ficha.setor}</span>
            {ficha.categoria && <span className="badge-status badge-status-pendente">{ficha.categoria}</span>}
            {ficha.subcategoria && <span className="badge-status badge-status-pendente">{ficha.subcategoria}</span>}
          </div>

          {fotoUrl && <img src={fotoUrl} alt="" style={{ maxWidth: 220, borderRadius: 8, marginBottom: 12 }} />}

          <h4 className="section-label">Ingredientes</h4>
          <div className="manage-list">
            {ficha.ingredientes.map((ing) => (
              <div className="manage-row" key={ing.id}>
                <div className="manage-row-info">
                  <strong>{ing.nome || '(sem nome)'}</strong>
                  <span>
                    Bruta: {ing.qtdBruta ?? '—'} {ing.unidade} · Líquida: {ing.qtdLiquida ?? '—'} · Fator correção:{' '}
                    {ing.fatorCorrecao ?? '—'}
                    {temCusto && 'qtdBase' in ing && (
                      <>
                        {' '}
                        · Custo total: R${' '}
                        {calcIngredienteCustoTotal(ing as FichaTecnicaRow['ingredientes'][number]).toFixed(2)} (unit. R${' '}
                        {calcIngredienteCustoUnitario(ing as FichaTecnicaRow['ingredientes'][number]).toFixed(4)})
                      </>
                    )}
                  </span>
                </div>
              </div>
            ))}
            {ficha.ingredientes.length === 0 && <div className="empty-state">Nenhum ingrediente cadastrado.</div>}
          </div>

          {custos && (
            <p className="field-hint" style={{ marginTop: 8 }}>
              Custo total da receita: R$ {custos.custoTotalReceita.toFixed(2)} · Preço sugerido:{' '}
              {(ficha as FichaTecnicaRow).preco_sugerido != null ? `R$ ${(ficha as FichaTecnicaRow).preco_sugerido!.toFixed(2)}` : '—'} ·
              Lucro bruto: {custos.lucroBruto == null ? '—' : `R$ ${custos.lucroBruto.toFixed(2)}`} · Margem:{' '}
              {custos.margemEstimada == null ? '—' : `${custos.margemEstimada.toFixed(1)}%`}
            </p>
          )}

          <h4 className="section-label">Modo de preparo</h4>
          <div className="manage-list">
            {ficha.etapas.map((et, i) => (
              <div className="manage-row" key={et.id}>
                <div className="manage-row-info">
                  <strong>
                    {i + 1}. {et.titulo || '(sem título)'}
                  </strong>
                  <span>{et.descricao}</span>
                </div>
              </div>
            ))}
            {ficha.etapas.length === 0 && <div className="empty-state">Nenhuma etapa cadastrada.</div>}
          </div>

          <div className="field-row" style={{ marginTop: 12 }}>
            {ficha.utensilios && (
              <div className="field">
                <label>Utensílios</label>
                <p>{ficha.utensilios}</p>
              </div>
            )}
            {ficha.equipamentos && (
              <div className="field">
                <label>Equipamentos</label>
                <p>{ficha.equipamentos}</p>
              </div>
            )}
          </div>
          {ficha.padrao_apresentacao && (
            <div className="field">
              <label>Padrão de apresentação</label>
              <p>{ficha.padrao_apresentacao}</p>
            </div>
          )}
          {ficha.tempo_preparo && (
            <div className="field">
              <label>Tempo de preparo</label>
              <p>{ficha.tempo_preparo}</p>
            </div>
          )}
          {ficha.alergenicos && (
            <div className="field">
              <label>Alergênicos</label>
              <p>{ficha.alergenicos}</p>
            </div>
          )}
          {ficha.observacoes_gerais && (
            <div className="field">
              <label>Observações gerais</label>
              <p>{ficha.observacoes_gerais}</p>
            </div>
          )}

          {ficha.vinculos.length > 0 && (
            <>
              <h4 className="section-label">Vínculos</h4>
              <div className="account-badges">
                {ficha.vinculos.map((v, i) => (
                  <span className="badge-status badge-status-pendente" key={`${v.tipo}-${v.id}-${i}`}>
                    {v.tipo}
                  </span>
                ))}
              </div>
            </>
          )}

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
