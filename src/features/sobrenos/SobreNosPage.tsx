import { useState } from 'react'
import { Icon, type IconName } from '../../components/Icon'
import { useSobreNosRealtime } from './useSobreNos'
import { SobreNosSecaoView } from './SobreNosSecaoView'
import type { SobreNosSecaoChave } from '../../types/database'

type SobreNosTab = 'hub' | SobreNosSecaoChave

const SUBMENU: { key: SobreNosSecaoChave; title: string; desc: string; icon: IconName }[] = [
  { key: 'historia', title: 'Nossa história', desc: 'Missão, visão e valores', icon: 'sobre-nos' },
  { key: 'time', title: 'Nosso time', desc: 'O que esperamos e o que não combina com a gente', icon: 'sobre-nos' },
  { key: 'cargos', title: 'Cargos e funções', desc: 'Quem faz o quê por aqui', icon: 'sobre-nos' },
]

export function SobreNosPage() {
  useSobreNosRealtime()
  const [tab, setTab] = useState<SobreNosTab>('hub')

  return (
    <div className="container">
      <div className="checklist-header">
        <div>
          <h2 className="page-title">Sobre nós</h2>
          <p className="page-subtitle">Nossa história, cultura e como o time se organiza</p>
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

      {tab !== 'hub' && <SobreNosSecaoView chave={tab} />}
    </div>
  )
}
