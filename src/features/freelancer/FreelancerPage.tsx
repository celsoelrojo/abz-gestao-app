import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Icon } from '../../components/Icon'
import { useFreelancersRealtime, FREELANCER_ESCALAS_KEY } from './useFreelancers'
import { FreelancerCadastroTab } from './FreelancerCadastroTab'
import { FreelancerEscalaTab } from './FreelancerEscalaTab'
import { EscalaFormModal } from './EscalaFormModal'

// Pedido do usuário: ícones quadrados e pequenos acima, nesta ordem — Escala
// de Freelancer, Nova Escala, Cadastro de Freelancer. "Nova Escala" é ação
// pura (abre o modal de criação direto, igual "Nova Reserva" em Reservas),
// por isso o modal fica aqui no topo em vez de dentro da aba Escala — assim
// funciona não importa qual aba está ativa. A "Escala de Freelancer" que
// aparece na Home do perfil freelancer (FreelancerHomePage, "Minha Escala")
// é uma tela separada e não muda com isto.
export function FreelancerPage() {
  const queryClient = useQueryClient()
  useFreelancersRealtime()
  const [tab, setTab] = useState<'cadastro' | 'escala'>('cadastro')
  const [criandoEscala, setCriandoEscala] = useState(false)

  return (
    <div className="container">
      <div className="checklist-header">
        <div>
          <h2 className="page-title">Freelancer</h2>
          <p className="page-subtitle">Cadastro e escala de freelancers</p>
        </div>
      </div>

      <div className="quick-actions">
        <button
          type="button"
          className={`quick-btn ${tab === 'escala' ? 'quick-btn-active' : ''}`}
          onClick={() => setTab('escala')}
        >
          <Icon name="freelancer-escala" className="quick-icon" />
          <span className="quick-label">Escala de Freelancer</span>
        </button>
        <button type="button" className="quick-btn" onClick={() => setCriandoEscala(true)}>
          <Icon name="freelancer-nova-escala" className="quick-icon" />
          <span className="quick-label">Nova Escala</span>
        </button>
        <button
          type="button"
          className={`quick-btn ${tab === 'cadastro' ? 'quick-btn-active' : ''}`}
          onClick={() => setTab('cadastro')}
        >
          <Icon name="freelancer-cadastro" className="quick-icon" />
          <span className="quick-label">Cadastro de Freelancer</span>
        </button>
      </div>

      {tab === 'cadastro' && <FreelancerCadastroTab />}
      {tab === 'escala' && <FreelancerEscalaTab />}

      {criandoEscala && (
        <EscalaFormModal
          escala={null}
          onClose={() => setCriandoEscala(false)}
          onSaved={async () => {
            setCriandoEscala(false)
            await queryClient.invalidateQueries({ queryKey: FREELANCER_ESCALAS_KEY })
          }}
        />
      )}
    </div>
  )
}
