import { useMemo, useState } from 'react'
import { isFullAdmin, useAuthStore } from '../../store/authStore'
import { useEstoqueItens } from '../estoque/useEstoque'
import { FICHA_SETORES } from './fichaConstants'
import { useFichasProducao } from './useFichasProducao'
import { ProducaoCalculadora } from './ProducaoCalculadora'
import type { FichaProducaoRow, Setor } from '../../types/database'

// Calculadora "solta" do módulo (pedido do usuário: sai de dentro de cada
// ficha e vira um submódulo próprio) — só a caixa de busca muda; o cálculo
// em si continua sendo o ProducaoCalculadora de sempre. RLS já resolve a
// visibilidade: Bar só recebe fichas do Bar, Cozinha só da Cozinha,
// Administrador recebe as duas (agrupadas por setor no seletor).
export function FichaProducaoCalculadoraTab() {
  const profile = useAuthStore((s) => s.profile)
  const admin = isFullAdmin(profile)
  const { data: fichas, isLoading } = useFichasProducao()
  const { data: estoqueItens } = useEstoqueItens()

  const profileSetor = profile?.setor
  const visibleSetores: Setor[] = useMemo(
    () =>
      admin
        ? [...FICHA_SETORES]
        : profileSetor && FICHA_SETORES.includes(profileSetor as (typeof FICHA_SETORES)[number])
          ? [profileSetor]
          : [],
    [admin, profileSetor],
  )

  // Só publicadas: calcular em cima de rascunho não tem receita validada por
  // trás — mesmo critério de visibilidade da aba Consultar.
  const publicadas = useMemo(
    () =>
      (fichas ?? [])
        .filter((f) => f.status === 'publicada' && visibleSetores.includes(f.setor as Setor))
        .sort((a, b) => a.nome.localeCompare(b.nome)),
    [fichas, visibleSetores],
  )

  const [busca, setBusca] = useState('')
  const [fichaId, setFichaId] = useState('')

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return termo ? publicadas.filter((f) => f.nome.toLowerCase().includes(termo)) : publicadas
  }, [publicadas, busca])

  const porSetor = useMemo(() => {
    const map = new Map<Setor, FichaProducaoRow[]>()
    visibleSetores.forEach((s) => map.set(s, []))
    filtradas.forEach((f) => map.get(f.setor as Setor)?.push(f))
    return map
  }, [filtradas, visibleSetores])

  const ficha = publicadas.find((f) => f.id === fichaId) ?? null

  return (
    <div>
      <div className="field-row" style={{ marginBottom: 16 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Buscar receita</label>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome da ficha..." />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Receita</label>
          <select value={fichaId} onChange={(e) => setFichaId(e.target.value)}>
            <option value="">Selecione...</option>
            {[...porSetor.entries()].map(([setor, setorFichas]) =>
              setorFichas.length === 0 ? null : (
                <optgroup key={setor} label={setor}>
                  {setorFichas.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome}
                    </option>
                  ))}
                </optgroup>
              ),
            )}
          </select>
        </div>
      </div>

      {isLoading && <div className="empty-state">Carregando…</div>}
      {!isLoading && publicadas.length === 0 && (
        <div className="empty-state">Nenhuma ficha de produção publicada ainda.</div>
      )}

      {!isLoading && !ficha && publicadas.length > 0 && (
        <div className="empty-state">Escolha uma receita acima para abrir a calculadora.</div>
      )}

      {ficha && (
        <div>
          <div className="account-badges" style={{ marginBottom: 12 }}>
            <span className="badge-status badge-status-ativa">{ficha.setor}</span>
            {ficha.categoria && <span className="badge-status badge-status-pendente">{ficha.categoria}</span>}
          </div>
          <ProducaoCalculadora
            key={ficha.id}
            ingredientes={ficha.ingredientes}
            estoqueItens={estoqueItens ?? []}
            qtdLotePadrao={ficha.qtd_lote_padrao}
            unidadeRendimento={ficha.unidade_rendimento}
          />
        </div>
      )}
    </div>
  )
}
