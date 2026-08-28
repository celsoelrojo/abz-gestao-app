import { useState } from 'react'
import { isManager, useAuthStore } from '../../store/authStore'
import { Icon, type IconName } from '../../components/Icon'
import { useEstoqueRealtime } from './useEstoque'
import { EstoqueAtualTab } from './EstoqueAtualTab'
import { EstoqueCadastrarProdutoTab } from './EstoqueCadastrarProdutoTab'
import { EstoqueEntradaTab } from './EstoqueEntradaTab'
import { EstoqueRetiradaTab } from './EstoqueRetiradaTab'
import { EstoqueLimitesTab } from './EstoqueLimitesTab'
import { EstoqueComprasTab } from './EstoqueComprasTab'

type EstoqueTab = 'hub' | 'atual' | 'cadastrar' | 'entrada' | 'retirada' | 'limites' | 'compras'

const SUBMENU: { key: EstoqueTab; title: string; desc: string; icon: IconName; managerOnly: boolean }[] = [
  { key: 'atual', title: 'Estoque', desc: 'Saldo por categoria', icon: 'estoque-atual', managerOnly: false },
  {
    key: 'cadastrar',
    title: 'Cadastrar Produto',
    desc: 'Base do produto: tipo, marca, categoria, validade',
    icon: 'estoque-cadastrar',
    managerOnly: false,
  },
  { key: 'entrada', title: 'Entrada no Estoque', desc: 'Cadastrar produto e registrar entrada', icon: 'estoque-entrada', managerOnly: false },
  { key: 'retirada', title: 'Retirada do Estoque', desc: 'Registrar saída de itens', icon: 'estoque-retirada', managerOnly: true },
  { key: 'limites', title: 'Estoque Mínimo e Máximo', desc: 'Configurar limites', icon: 'estoque-limites', managerOnly: true },
  { key: 'compras', title: 'Lista de Compras', desc: 'Sugestão de compra', icon: 'estoque-compras', managerOnly: true },
]

export function EstoquePage() {
  const profile = useAuthStore((s) => s.profile)
  const canManage = isManager(profile, undefined)
  useEstoqueRealtime()

  const [tab, setTab] = useState<EstoqueTab>('hub')

  // Guarda de rota: se o usuário perdeu o cargo de gestão enquanto estava
  // numa tela managerOnly (ex. sessão antiga), volta pro hub — mesma
  // proteção do protótipo (renderEstoqueModuleTabs).
  const activeTab = SUBMENU.find((s) => s.key === tab)?.managerOnly && !canManage ? 'hub' : tab

  const visibleSubmenu = SUBMENU.filter((s) => !s.managerOnly || canManage)

  return (
    <div className="container">
      <div className="checklist-header">
        <div>
          <h2 className="page-title">Estoque e Compras</h2>
          <p className="page-subtitle">Controle de saldo, entradas, retiradas e compras</p>
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

      {activeTab === 'atual' && <EstoqueAtualTab />}
      {activeTab === 'cadastrar' && <EstoqueCadastrarProdutoTab />}
      {activeTab === 'entrada' && <EstoqueEntradaTab onIrParaCadastro={() => setTab('cadastrar')} />}
      {activeTab === 'retirada' && <EstoqueRetiradaTab />}
      {activeTab === 'limites' && <EstoqueLimitesTab />}
      {activeTab === 'compras' && <EstoqueComprasTab />}
    </div>
  )
}
