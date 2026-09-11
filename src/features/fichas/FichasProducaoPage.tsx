import { useState } from 'react'
import { isManager, useAuthStore } from '../../store/authStore'
import { Icon, type IconName } from '../../components/Icon'
import { useFichasProducaoRealtime } from './useFichasProducao'
import { FichasProducaoConsultaTab } from './FichasProducaoConsultaTab'
import { FichaProducaoCalculadoraTab } from './FichaProducaoCalculadoraTab'
import { FichasProducaoGerenciarTab } from './FichasProducaoGerenciarTab'

type FichasProducaoTab = 'hub' | 'consultar' | 'calculadora' | 'gerenciar'

// Pedido do usuário: 3 submódulos em ícone, igual ao padrão do hub de
// Estoque e Compras (SUBMENU + .modules-grid) — a Calculadora deixa de viver
// dentro de cada ficha e vira um card próprio.
const SUBMENU: { key: FichasProducaoTab; title: string; desc: string; icon: IconName; managerOnly: boolean }[] = [
  { key: 'consultar', title: 'Fichas de Produção', desc: 'Consultar receitas publicadas', icon: 'fichas-producao-hub', managerOnly: false },
  {
    key: 'calculadora',
    title: 'Calculadora de Produção',
    desc: 'Escale uma receita pra qualquer rendimento',
    icon: 'fichas-producao-calculadora',
    managerOnly: false,
  },
  { key: 'gerenciar', title: 'Gerenciar Fichas', desc: 'Criar, editar e publicar', icon: 'fichas-producao-gerenciar', managerOnly: true },
]

export function FichasProducaoPage() {
  const profile = useAuthStore((s) => s.profile)
  const canManage = isManager(profile, undefined)
  useFichasProducaoRealtime()

  const [tab, setTab] = useState<FichasProducaoTab>('hub')

  function podeVer(s: (typeof SUBMENU)[number]) {
    return !s.managerOnly || canManage
  }

  // Guarda de rota: se o usuário perdeu o cargo de gestor enquanto estava em
  // Gerenciar (ex. sessão antiga), volta pro hub — mesmo padrão do Estoque.
  const activeSub = SUBMENU.find((s) => s.key === tab)
  const activeTab = activeSub && !podeVer(activeSub) ? 'hub' : tab

  const visibleSubmenu = SUBMENU.filter(podeVer)

  return (
    <div className="container">
      <div className="checklist-header">
        <div>
          <h2 className="page-title">Fichas de Produção</h2>
          <p className="page-subtitle">Receitas de produção, calculadora de escala e gerenciamento</p>
        </div>
        {activeTab !== 'hub' && (
          <button className="btn btn-ghost" onClick={() => setTab('hub')}>
            ← Voltar
          </button>
        )}
      </div>

      {activeTab === 'hub' && (
        <div className="modules-grid">
          {visibleSubmenu.map((s) => (
            <button key={s.key} className="module-btn" onClick={() => setTab(s.key)}>
              <Icon name={s.icon} className="module-icon" />
              <span className="module-title">{s.title}</span>
              <span className="module-desc">{s.desc}</span>
            </button>
          ))}
        </div>
      )}

      {activeTab === 'consultar' && <FichasProducaoConsultaTab />}
      {activeTab === 'calculadora' && <FichaProducaoCalculadoraTab />}
      {activeTab === 'gerenciar' && canManage && <FichasProducaoGerenciarTab />}
    </div>
  )
}
