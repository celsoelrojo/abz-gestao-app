import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useEstoqueItens } from '../estoque/useEstoque'
import { calcProducaoFichaCustoTotal, calcProducaoIngredienteCustoTotal } from './fichaHelpers'
import { FICHAS_PRODUCAO_LOTES_KEY, useFichaProducaoLotes } from './useFichasProducao'
import { FichaProducaoLoteFormModal } from './FichaProducaoLoteFormModal'
import { ProducaoCalculadora } from './ProducaoCalculadora'
import { fichaImagemUrl } from './fichaStorage'
import type { EstoqueItemRow, FichaProducaoLoteRow, FichaProducaoRow } from '../../types/database'

export function FichaProducaoDetailModal({ ficha, onClose }: { ficha: FichaProducaoRow; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { data: lotes } = useFichaProducaoLotes(ficha.id)
  const { data: estoqueItens } = useEstoqueItens()
  const [registrandoLote, setRegistrandoLote] = useState(false)
  const [aba, setAba] = useState<'ficha' | 'lotes' | 'calculadora'>('ficha')

  async function refetchLotes() {
    await queryClient.invalidateQueries({ queryKey: FICHAS_PRODUCAO_LOTES_KEY(ficha.id) })
  }

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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            <button className={`btn ${aba === 'ficha' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setAba('ficha')}>
              Ficha
            </button>
            <button className={`btn ${aba === 'lotes' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setAba('lotes')}>
              Lotes
            </button>
            <button className={`btn ${aba === 'calculadora' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setAba('calculadora')}>
              Calculadora de Produção
            </button>
          </div>

          {aba === 'ficha' && <FichaInfo ficha={ficha} estoqueItens={estoqueItens ?? []} />}

          {aba === 'lotes' && (
            <div>
              <button className="btn btn-primary" style={{ marginBottom: 16 }} onClick={() => setRegistrandoLote(true)}>
                + Registrar lote
              </button>
              <LotesList lotes={lotes ?? []} />
            </div>
          )}

          {aba === 'calculadora' && (
            <ProducaoCalculadora
              ingredientes={ficha.ingredientes}
              estoqueItens={estoqueItens ?? []}
              qtdLotePadrao={ficha.qtd_lote_padrao}
              unidadeRendimento={ficha.unidade_rendimento}
            />
          )}

          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose}>
              Fechar
            </button>
          </div>
        </div>
      </div>

      {registrandoLote && (
        <FichaProducaoLoteFormModal
          ficha={ficha}
          lotesExistentes={lotes ?? []}
          onClose={() => setRegistrandoLote(false)}
          onSaved={async () => {
            setRegistrandoLote(false)
            await refetchLotes()
          }}
        />
      )}
    </div>
  )
}

function FichaInfo({ ficha, estoqueItens }: { ficha: FichaProducaoRow; estoqueItens: EstoqueItemRow[] }) {
  const custoTotalReceita = calcProducaoFichaCustoTotal(ficha.ingredientes)

  return (
    <div>
      <div className="account-badges" style={{ marginBottom: 12 }}>
        <span className="badge-status badge-status-ativa">{ficha.setor}</span>
        {ficha.categoria && <span className="badge-status badge-status-pendente">{ficha.categoria}</span>}
      </div>

      <h4 className="section-label">Ingredientes</h4>
      <div className="manage-list">
        {ficha.ingredientes.map((ing) => {
          const item = estoqueItens.find((it) => it.id === ing.estoqueItemId)
          return (
            <div className="manage-row" key={ing.id}>
              <div className="manage-row-info">
                <strong>{item?.title ?? '(produto não encontrado)'}</strong>
                <span>
                  Qtd: {ing.quantidade ?? '—'} {item?.unidade ?? ''} · Custo: R$ {calcProducaoIngredienteCustoTotal(ing).toFixed(2)}
                  {ing.percentualPerda != null ? ` · Perda: ${ing.percentualPerda}%` : ''}
                </span>
              </div>
            </div>
          )
        })}
        {ficha.ingredientes.length === 0 && <div className="empty-state">Nenhum ingrediente cadastrado.</div>}
      </div>
      {ficha.ingredientes.length > 0 && <p className="field-hint">Custo total da receita: R$ {custoTotalReceita.toFixed(2)}</p>}

      <h4 className="section-label">Modo de preparo</h4>
      <div className="manage-list">
        {ficha.etapas.map((et, i) => (
          <div className="manage-row" key={et.id}>
            <div className="manage-row-info">
              <strong>
                {i + 1}. {et.titulo || '(sem título)'}
              </strong>
              <span style={{ display: 'block' }}>{et.descricao}</span>
              {et.equipamento && <span style={{ display: 'block' }}>Equipamento: {et.equipamento}</span>}
              {et.imagens.length > 0 && <span style={{ display: 'block' }}>{et.imagens.length} foto(s)</span>}
            </div>
          </div>
        ))}
        {ficha.etapas.length === 0 && <div className="empty-state">Nenhuma etapa cadastrada.</div>}
      </div>

      <div className="field-row">
        <div className="field">
          <label>Validade</label>
          <p>
            {ficha.prazo_validade ? `${ficha.prazo_validade} dias` : '—'}
            {ficha.condicao_armazenamento ? ` · ${ficha.condicao_armazenamento}` : ''}
          </p>
        </div>
        {ficha.qtd_lote_padrao != null && (
          <div className="field">
            <label>Rendimento</label>
            <p>
              {ficha.qtd_lote_padrao} {ficha.unidade_rendimento ?? ''}
            </p>
          </div>
        )}
      </div>

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

      {ficha.historico.length > 0 && (
        <>
          <h4 className="section-label">Histórico</h4>
          <div className="manage-list">
            {[...ficha.historico].reverse().map((h, i) => (
              <div className="manage-row" key={i}>
                <div className="manage-row-info">
                  <span>
                    {h.tipo} · {h.autor} · {new Date(h.data).toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function LotesList({ lotes }: { lotes: FichaProducaoLoteRow[] }) {
  const [fotoUrls, setFotoUrls] = useState<Record<string, string>>({})

  async function verFoto(lote: FichaProducaoLoteRow) {
    if (!lote.foto_url) return
    const url = fotoUrls[lote.id] ?? (await fichaImagemUrl(lote.foto_url))
    setFotoUrls((prev) => ({ ...prev, [lote.id]: url }))
    window.open(url, '_blank', 'noreferrer')
  }

  return (
    <div className="manage-list">
      {lotes.length === 0 && <div className="empty-state">Nenhum lote registrado ainda.</div>}
      {lotes.map((l) => (
        <div className="manage-row" key={l.id}>
          <div className="manage-row-info">
            <strong>{l.numero_lote}</strong>
            <span style={{ display: 'block' }}>
              {new Date(l.data_hora_producao).toLocaleString('pt-BR')} · {l.responsavel} · Qtd: {l.quantidade_produzida}
            </span>
            <span style={{ display: 'block' }}>
              Validade: {l.data_hora_validade ? new Date(l.data_hora_validade).toLocaleString('pt-BR') : '—'}
              {l.justificativa_alteracao ? ` · Ajustada: ${l.justificativa_alteracao}` : ''}
            </span>
            {l.observacao && <span style={{ display: 'block' }}>{l.observacao}</span>}
          </div>
          {l.foto_url && (
            <div className="manage-row-actions">
              <button className="icon-btn" onClick={() => verFoto(l)} title="Ver foto">
                📷
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
