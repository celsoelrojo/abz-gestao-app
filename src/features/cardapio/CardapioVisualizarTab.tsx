import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isManager, useAuthStore } from '../../store/authStore'
import { confirmar } from '../../store/confirmStore'
import { useFichasTecnicas } from '../fichas/useFichasTecnicas'
import { CARDAPIOS_KEY, excluirCardapio, useCardapios } from './useCardapios'
import { diasDaSemana, semanaContem, tituloSemana } from './cardapioHelpers'
import { CardapioForm } from './CardapioForm'
import type { CardapioRow } from '../../types/database'

export function CardapioVisualizarTab() {
  const profile = useAuthStore((s) => s.profile)
  const queryClient = useQueryClient()
  // Excluir é só Administrador / Gestor da Cozinha (RLS cardapios_delete).
  const podeExcluir = isManager(profile, 'Cozinha')
  const { data: cardapios, isLoading } = useCardapios()

  const [aberto, setAberto] = useState<CardapioRow | null>(null)
  const [editando, setEditando] = useState<CardapioRow | null>(null)

  async function excluir(c: CardapioRow) {
    if (!(await confirmar(`Excluir o cardápio da ${tituloSemana(c.semana_inicio).toLowerCase()}? Esta ação não pode ser desfeita.`)))
      return
    try {
      await excluirCardapio(c.id)
      await queryClient.invalidateQueries({ queryKey: CARDAPIOS_KEY })
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Erro ao excluir o cardápio.')
    }
  }

  return (
    <div>
      <h3 className="page-title" style={{ marginBottom: 4 }}>
        Visualizar cardápio
      </h3>
      <p className="page-subtitle" style={{ marginBottom: 16 }}>
        Cardápios semanais cadastrados, da semana mais recente para a mais antiga.
      </p>

      {isLoading && <div className="empty-state">Carregando…</div>}
      {!isLoading && (cardapios ?? []).length === 0 && <div className="empty-state">Nenhum cardápio cadastrado ainda.</div>}

      <div className="manage-list">
        {(cardapios ?? []).map((c) => (
          <div className="manage-row" key={c.id}>
            <div className="manage-row-info">
              <strong>
                {tituloSemana(c.semana_inicio)}
                {semanaContem(c.semana_inicio, new Date()) && (
                  <span className="task-today-badge" style={{ marginLeft: 8 }}>
                    Semana atual
                  </span>
                )}
              </strong>
              <span>
                {c.dias.length} {c.dias.length === 1 ? 'dia com prato' : 'dias com prato'}
              </span>
            </div>
            <div className="manage-row-actions">
              <button className="icon-btn" title="Ver" onClick={() => setAberto(c)}>
                👁
              </button>
              <button className="icon-btn" title="Editar" onClick={() => setEditando(c)}>
                ✎
              </button>
              {podeExcluir && (
                <button className="icon-btn danger" title="Excluir" onClick={() => excluir(c)}>
                  🗑
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {aberto && <CardapioDetalheModal cardapio={aberto} onClose={() => setAberto(null)} />}

      {editando && (
        <div className="modal-overlay">
          <div className="modal modal-wide">
            <div className="modal-header">
              <h3>Editar cardápio — {tituloSemana(editando.semana_inicio)}</h3>
              <button className="modal-close" onClick={() => setEditando(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <CardapioForm cardapio={editando} onSaved={() => setEditando(null)} onCancel={() => setEditando(null)} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CardapioDetalheModal({ cardapio, onClose }: { cardapio: CardapioRow; onClose: () => void }) {
  const { data: fichas } = useFichasTecnicas()
  const dias = useMemo(() => diasDaSemana(cardapio.semana_inicio), [cardapio.semana_inicio])
  const pratoPorData = useMemo(() => new Map(cardapio.dias.map((d) => [d.data, d])), [cardapio.dias])

  // Nome atual da ficha quando ela ainda existe (acompanha renomeações); senão
  // o nome gravado na hora de salvar.
  const nomeDoPrato = (data: string) => {
    const d = pratoPorData.get(data)
    if (!d) return null
    return (fichas ?? []).find((f) => f.id === d.fichaTecnicaId)?.nome ?? d.nome
  }

  return (
    <div className="modal-overlay">
      <div className="modal modal-wide">
        <div className="modal-header">
          <h3>{tituloSemana(cardapio.semana_inicio)}</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="manage-list" style={{ marginBottom: 16 }}>
            {dias.map((dia) => {
              const prato = nomeDoPrato(dia.iso)
              return (
                <div className="manage-row" key={dia.iso}>
                  <div className="manage-row-info">
                    <span style={{ display: 'block' }}>{dia.rotulo}</span>
                    {prato ? (
                      <strong style={{ display: 'block' }}>{prato}</strong>
                    ) : (
                      <span style={{ display: 'block', opacity: 0.55 }}>Sem prato</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {cardapio.observacoes && (
            <div className="field">
              <label>Observações</label>
              <p>{cardapio.observacoes}</p>
            </div>
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
