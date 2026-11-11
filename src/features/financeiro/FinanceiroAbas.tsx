import { useLocation, useNavigate } from 'react-router-dom'

// Alterna entre as duas partes do Financeiro (cada uma é uma rota, então o
// botão "voltar" e o recarregar da página mantêm onde a pessoa estava).
export function FinanceiroAbas() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const emCmv = pathname.startsWith('/financeiro/cmv')

  return (
    <div className="sector-filter" style={{ marginBottom: 12 }}>
      <button type="button" className={`sector-filter-btn ${!emCmv ? 'active' : ''}`} onClick={() => navigate('/financeiro')}>
        Contas a pagar
      </button>
      <button type="button" className={`sector-filter-btn ${emCmv ? 'active' : ''}`} onClick={() => navigate('/financeiro/cmv')}>
        CMV
      </button>
    </div>
  )
}
