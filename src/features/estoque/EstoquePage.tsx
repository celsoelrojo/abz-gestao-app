import { useState } from 'react'
import { isFullAdmin, isManager, useAuthStore } from '../../store/authStore'
import { Icon, type IconName } from '../../components/Icon'
import { usePedidosCompraRealtime } from './usePedidosCompra'
import { useEstoqueRealtime } from './useEstoque'
import { EstoqueAtualTab } from './EstoqueAtualTab'
import { EstoqueCadastrarProdutoTab } from './EstoqueCadastrarProdutoTab'
import { EstoqueEntradaTab } from './EstoqueEntradaTab'
import { EstoqueRetiradaTab } from './EstoqueRetiradaTab'
import { EstoqueLimitesTab } from './EstoqueLimitesTab'
import { EstoqueComprasTab } from './EstoqueComprasTab'
import { PedidosCompraTab } from './PedidosCompraTab'
import { ReceberMercadoriaTab } from './ReceberMercadoriaTab'

type EstoqueTab = 'hub' | 'atual' | 'cadastrar' | 'entrada' | 'retirada' | 'limites' | 'compras' | 'pedidos' | 'receber'

const SUBMENU: {
  key: EstoqueTab
  title: string
  desc: string
  icon: IconName
  managerOnly: boolean
  adminOnly?: boolean
}[] = [
  { key: 'atual', title: 'Estoque', desc: 'Saldo por categoria', icon: 'estoque-atual', managerOnly: false },
  { key: 'entrada', title: 'Entrada no Estoque', desc: 'Cadastrar produto e registrar entrada', icon: 'estoque-entrada', managerOnly: false },
  { key: 'retirada', title: 'Retirada do Estoque', desc: 'Registrar saída de itens', icon: 'estoque-retirada', managerOnly: true },
  {
    key: 'receber',
    title: 'Receber Mercadoria',
    desc: 'Conferir pedidos que chegaram',
    icon: 'estoque-entrada',
    managerOnly: false,
  },
  {
    key: 'pedidos',
    title: 'Pedidos de Compra',
    desc: 'Registrar compra e acompanhar',
    icon: 'estoque-compras',
    managerOnly: false,
    adminOnly: true,
  },
  { key: 'compras', title: 'Lista de Compras', desc: 'Sugestão de compra', icon: 'estoque-compras', managerOnly: true },
  {
    key: 'cadastrar',
    title: 'Cadastrar Produto',
    desc: 'Base do produto: tipo, marca, categoria, validade',
    icon: 'estoque-cadastrar',
    managerOnly: true,
  },
  { key: 'limites', title: 'Estoque Mínimo e Máximo', desc: 'Configurar limites', icon: 'estoque-limites', managerOnly: true },
]

export function EstoquePage() {
  const profile = useAuthStore((s) => s.profile)
  const canManage = isManager(profile, undefined)
  const admin = isFullAdmin(profile)
  useEstoqueRealtime()
  usePedidosCompraRealtime()

  const [tab, setTab] = useState<EstoqueTab>('hub')

  function podeVer(s: (typeof SUBMENU)[number]) {
    return (!s.managerOnly || canManage) && (!s.adminOnly || admin)
  }

  // Guarda de rota: se o usuário perdeu o cargo/papel enquanto estava numa
  // tela restrita (ex. sessão antiga), volta pro hub.
  const activeSub = SUBMENU.find((s) => s.key === tab)
  const activeTab = activeSub && !podeVer(activeSub) ? 'hub' : tab

  const visibleSubmenu = SUBMENU.filter(podeVer)

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
      {activeTab === 'entrada' && (
        <EstoqueEntradaTab onIrParaCadastro={canManage ? () => setTab('cadastrar') : undefined} />
      )}
      {activeTab === 'retirada' && <EstoqueRetiradaTab />}
      {activeTab === 'limites' && <EstoqueLimitesTab />}
      {activeTab === 'compras' && <EstoqueComprasTab />}
      {activeTab === 'pedidos' && <PedidosCompraTab />}
      {activeTab === 'receber' && <ReceberMercadoriaTab />}
    </div>
  )
}
