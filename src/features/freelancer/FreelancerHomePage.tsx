import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { Icon } from '../../components/Icon'
import { formatDateBR, isoDate } from '../../lib/date'
import { useMinhaEscala } from './useFreelancers'
import type { FreelancerEscalaRow } from '../../types/database'

const todayIso = isoDate(new Date())

// Home dedicada ao perfil freelancer (pedido do usuário) — troca o painel
// "Módulos" completo do HomePage.tsx normal por só o que foi liberado:
// a própria escala + Checklist + Sobre nós. Nunca mostra valor_pagamento
// (decisão do usuário) mesmo a linha vindo com o campo — é só não renderizar.
export function FreelancerHomePage() {
  const profile = useAuthStore((s) => s.profile)
  const { data: escalas, isLoading } = useMinhaEscala()
  const [verAnteriores, setVerAnteriores] = useState(false)

  const { proximas, anteriores } = useMemo(() => {
    const lista = escalas ?? []
    return {
      proximas: lista.filter((e) => e.data >= todayIso).sort((a, b) => a.data.localeCompare(b.data)),
      anteriores: lista.filter((e) => e.data < todayIso).sort((a, b) => b.data.localeCompare(a.data)),
    }
  }, [escalas])

  return (
    <div className="container">
      <h2 className="page-title" style={{ marginBottom: 4 }}>
        Olá, {profile?.nome ?? 'freelancer'}
      </h2>
      <p className="page-subtitle" style={{ marginBottom: 20 }}>
        Seus próximos turnos e o que você pode usar por aqui
      </p>

      <h3 className="section-label">Minha Escala</h3>
      {isLoading && <div className="empty-state">Carregando…</div>}
      {!isLoading && (
        <div className="manage-list" style={{ marginBottom: 12 }}>
          {proximas.length === 0 && <div className="empty-state">Nenhum turno programado por enquanto.</div>}
          {proximas.map((e) => (
            <EscalaRow key={e.id} escala={e} destaque={e.data === todayIso} />
          ))}
        </div>
      )}

      {anteriores.length > 0 && (
        <>
          <button type="button" className="btn btn-ghost" style={{ marginBottom: 12 }} onClick={() => setVerAnteriores((v) => !v)}>
            {verAnteriores ? 'Ocultar turnos anteriores' : `Ver turnos anteriores (${anteriores.length})`}
          </button>
          {verAnteriores && (
            <div className="manage-list" style={{ marginBottom: 12, opacity: 0.7 }}>
              {anteriores.map((e) => (
                <EscalaRow key={e.id} escala={e} destaque={false} />
              ))}
            </div>
          )}
        </>
      )}

      <h3 className="section-label" style={{ marginTop: 28 }}>
        Módulos
      </h3>
      <div className="modules-grid">
        <Link className="module-btn" to="/checklist">
          <Icon name="checklist" className="module-icon" />
          <span className="module-title">Checklist</span>
          <span className="module-desc">Rotina do seu turno</span>
        </Link>
        <Link className="module-btn" to="/sobre-nos">
          <Icon name="sobre-nos" className="module-icon" />
          <span className="module-title">Sobre nós</span>
          <span className="module-desc">História, cultura e cargos</span>
        </Link>
      </div>
    </div>
  )
}

function EscalaRow({ escala, destaque }: { escala: FreelancerEscalaRow; destaque: boolean }) {
  return (
    <div className={`manage-row ${destaque ? 'task-row-today' : ''}`}>
      <div className="manage-row-info">
        <strong>
          {formatDateBR(escala.data)} · {escala.periodo}
          {destaque && <span className="task-today-badge" style={{ marginLeft: 8 }}>Hoje</span>}
        </strong>
        <span>
          {escala.setor}
          {escala.hora_inicio || escala.hora_fim ? ` · ${escala.hora_inicio ?? '—'}–${escala.hora_fim ?? '—'}` : ''}
          {escala.funcao_turno ? ` · ${escala.funcao_turno}` : ''}
        </span>
        {escala.observacoes && <span>{escala.observacoes}</span>}
      </div>
    </div>
  )
}
