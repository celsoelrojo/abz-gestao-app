import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isFullAdmin, isManager, useAuthStore } from '../../store/authStore'
import { confirmar } from '../../store/confirmStore'
import { supabase } from '../../lib/supabaseClient'
import { MAPA_BLOCKS_KEY, useMapaBlocks } from './useMapas'
import { mapaImagemUrl } from './mapaStorage'
import { MapaBlockFormModal } from './MapaBlockFormModal'
import type { MapaBlockRow, MapaFluxogramaRow } from '../../types/database'

export function MapaDetailModal({ mapa, onClose }: { mapa: MapaFluxogramaRow; onClose: () => void }) {
  const profile = useAuthStore((s) => s.profile)
  const queryClient = useQueryClient()
  const admin = isFullAdmin(profile)
  const canManage = isManager(profile, mapa.setor)

  const { data: blocks } = useMapaBlocks(mapa.id)
  const [addingTipo, setAddingTipo] = useState<'text' | 'image' | null>(null)
  const [editingBlock, setEditingBlock] = useState<MapaBlockRow | null>(null)

  async function refetch() {
    await queryClient.invalidateQueries({ queryKey: MAPA_BLOCKS_KEY(mapa.id) })
  }

  async function moveBlock(list: MapaBlockRow[], index: number, direction: 'up' | 'down') {
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    const a = list[index]
    const b = list[swapIndex]
    if (!a || !b) return
    await supabase.from('mapa_blocks').update({ ordem: b.ordem }).eq('id', a.id)
    await supabase.from('mapa_blocks').update({ ordem: a.ordem }).eq('id', b.id)
    await refetch()
  }

  async function deleteBlock(block: MapaBlockRow) {
    if (!(await confirmar('Excluir este bloco? Esta ação não pode ser desfeita.'))) return
    const { error } = await supabase.from('mapa_blocks').delete().eq('id', block.id)
    if (error) {
      window.alert(error.message)
      return
    }
    await refetch()
  }

  const list = blocks ?? []
  const proximaOrdem = list.length > 0 ? Math.max(...list.map((b) => b.ordem)) + 1 : 0

  return (
    <div className="modal-overlay">
      <div className="modal modal-wide">
        <div className="modal-header">
          <h3>{mapa.title}</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="account-badges" style={{ marginBottom: 16 }}>
            <span className="badge-status badge-status-ativa">{mapa.setor}</span>
            <span className="badge-status badge-status-pendente">{mapa.kind === 'mapa' ? 'Mapa' : 'Fluxograma'}</span>
          </div>

          <div className="manage-list">
            {list.length === 0 && <div className="empty-state">Nenhum bloco cadastrado ainda.</div>}
            {list.map((block, idx) => (
              <BlockRow
                key={block.id}
                block={block}
                canManage={canManage}
                canDelete={admin}
                isFirst={idx === 0}
                isLast={idx === list.length - 1}
                onMoveUp={() => moveBlock(list, idx, 'up')}
                onMoveDown={() => moveBlock(list, idx, 'down')}
                onEdit={() => setEditingBlock(block)}
                onDelete={() => deleteBlock(block)}
              />
            ))}
          </div>

          {canManage && (
            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost" onClick={() => setAddingTipo('text')}>
                + Texto
              </button>
              <button className="btn btn-ghost" onClick={() => setAddingTipo('image')}>
                + Imagem
              </button>
            </div>
          )}

          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose}>
              Fechar
            </button>
          </div>
        </div>
      </div>

      {(addingTipo || editingBlock) && (
        <MapaBlockFormModal
          mapaId={mapa.id}
          setor={mapa.setor}
          proximaOrdem={proximaOrdem}
          block={editingBlock}
          tipoInicial={addingTipo ?? 'text'}
          onClose={() => {
            setAddingTipo(null)
            setEditingBlock(null)
          }}
          onSaved={async () => {
            setAddingTipo(null)
            setEditingBlock(null)
            await refetch()
          }}
        />
      )}
    </div>
  )
}

function BlockRow({
  block,
  canManage,
  canDelete,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
}: {
  block: MapaBlockRow
  canManage: boolean
  canDelete: boolean
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  useEffect(() => {
    if (block.type !== 'image' || !block.image_url) return
    let active = true
    mapaImagemUrl(block.image_url).then((url) => {
      if (active) setImageUrl(url)
    })
    return () => {
      active = false
    }
  }, [block.type, block.image_url])

  return (
    <div className="manage-row">
      <div className="manage-row-info">
        {block.title && <strong>{block.title}</strong>}
        {block.type === 'text' && <span style={{ display: 'block' }}>{block.content}</span>}
        {block.type === 'image' && imageUrl && (
          <img src={imageUrl} alt={block.title} style={{ maxWidth: 220, borderRadius: 8, marginTop: 6 }} />
        )}
      </div>
      {canManage && (
        <div className="manage-row-actions">
          <button className="icon-btn" disabled={isFirst} onClick={onMoveUp} title="Mover para cima">
            ↑
          </button>
          <button className="icon-btn" disabled={isLast} onClick={onMoveDown} title="Mover para baixo">
            ↓
          </button>
          <button className="icon-btn" onClick={onEdit} title="Editar">
            ✎
          </button>
          {canDelete && (
            <button className="icon-btn danger" onClick={onDelete} title="Excluir">
              🗑
            </button>
          )}
        </div>
      )}
    </div>
  )
}
