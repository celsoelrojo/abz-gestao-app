import { useState } from 'react'
import { Icon, type IconName } from '../../components/Icon'
import { useCardapiosRealtime } from './useCardapios'
import { CardapioAdicionarTab } from './CardapioAdicionarTab'
import { CardapioVisualizarTab } from './CardapioVisualizarTab'

type CardapioTab = 'hub' | 'adicionar' | 'visualizar'

// Módulo exclusivo da Cozinha e da Administração (rota e RLS) — 2 submódulos
// em ícone, mesmo padrão de hub de Estoque e Fichas de Produção.
const SUBMENU: { key: Exclude<CardapioTab, 'hub'>; title: string; desc: string; icon: IconName }[] = [
  { key: 'adicionar', title: 'Adicionar cardápio', desc: 'Montar o cardápio da semana, um prato por dia', icon: 'cardapio-adicionar' },
  { key: 'visualizar', title: 'Visualizar cardápio', desc: 'Consultar, editar e excluir os cardápios semanais', icon: 'cardapio-visualizar' },
]

export function CardapioPage() {
  useCardapiosRealtime()
  const [tab, setTab] = useState<CardapioTab>('hub')

  return (
    <div className="container">
      <div className="checklist-header">
        <div>
          <h2 className="page-title">Cardápio RAF</h2>
          <p className="page-subtitle">Cardápios da cozinha</p>
        </div>
        {tab !== 'hub' && (
          <button className="btn btn-ghost" onClick={() => setTab('hub')}>
            ← Voltar
          </button>
        )}
      </div>

      {tab === 'hub' && (
        <div className="modules-grid">
          {SUBMENU.map((s) => (
            <button key={s.key} className="module-btn" onClick={() => setTab(s.key)}>
              <Icon name={s.icon} className="module-icon" />
              <span className="module-title">{s.title}</span>
              <span className="module-desc">{s.desc}</span>
            </button>
          ))}
        </div>
      )}

      {tab === 'adicionar' && <CardapioAdicionarTab />}
      {tab === 'visualizar' && <CardapioVisualizarTab />}
    </div>
  )
}
