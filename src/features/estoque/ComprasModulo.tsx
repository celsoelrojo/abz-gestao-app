import { useState } from 'react'
import { isFullAdmin, useAuthStore } from '../../store/authStore'
import { CotacoesTab } from './CotacoesTab'
import { EstoqueComprasTab } from './EstoqueComprasTab'
import { PedidosCompraTab } from './PedidosCompraTab'

type Aba = 'lista' | 'cotacoes' | 'pedidos'

// Um submódulo só pro ciclo de compra: o que falta (Lista), o preço entre
// fornecedores (Cotações) e o que foi pedido (Pedidos). Gestor de setor vê só a
// Lista; Cotações e Pedidos são da administração.
export function ComprasModulo() {
  const admin = isFullAdmin(useAuthStore((s) => s.profile))
  const [aba, setAba] = useState<Aba>('lista')

  const abas: { key: Aba; label: string }[] = [
    { key: 'lista', label: 'Lista de Compras' },
    ...(admin ? [{ key: 'cotacoes' as const, label: 'Cotações' }, { key: 'pedidos' as const, label: 'Pedidos' }] : []),
  ]

  return (
    <div>
      {abas.length > 1 && (
        <div className="sector-filter" style={{ marginBottom: 16 }}>
          {abas.map((a) => (
            <button key={a.key} type="button" className={`sector-filter-btn ${aba === a.key ? 'active' : ''}`} onClick={() => setAba(a.key)}>
              {a.label}
            </button>
          ))}
        </div>
      )}
      {aba === 'lista' && <EstoqueComprasTab />}
      {aba === 'cotacoes' && admin && <CotacoesTab />}
      {aba === 'pedidos' && admin && <PedidosCompraTab />}
    </div>
  )
}
