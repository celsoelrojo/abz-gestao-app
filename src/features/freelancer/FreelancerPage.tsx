import { useState } from 'react'
import { useFreelancersRealtime } from './useFreelancers'
import { FreelancerCadastroTab } from './FreelancerCadastroTab'
import { FreelancerEscalaTab } from './FreelancerEscalaTab'

export function FreelancerPage() {
  useFreelancersRealtime()
  const [tab, setTab] = useState<'cadastro' | 'escala'>('cadastro')

  return (
    <div className="container">
      <div className="checklist-header">
        <div>
          <h2 className="page-title">Freelancer</h2>
          <p className="page-subtitle">Cadastro e escala de freelancers</p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button className={`btn ${tab === 'cadastro' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('cadastro')}>
            Cadastro de Freelancer
          </button>
          <button className={`btn ${tab === 'escala' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('escala')}>
            Escala de Freelancers
          </button>
        </div>
      </div>

      {tab === 'cadastro' && <FreelancerCadastroTab />}
      {tab === 'escala' && <FreelancerEscalaTab />}
    </div>
  )
}
