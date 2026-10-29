import { useMemo, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useFichasTecnicas } from '../fichas/useFichasTecnicas'
import { CARDAPIOS_KEY, atualizarCardapio, criarCardapio } from './useCardapios'
import { diasDaSemana, pratosPorIndice, proximaSegunda, segundaDaSemana, tituloSemana } from './cardapioHelpers'
import type { CardapioDia, CardapioRow } from '../../types/database'

// Formulário do cardápio SEMANAL: uma semana (segunda a domingo) e, em cada
// dia, um prato escolhido entre as Fichas Técnicas da Cozinha. Sem preço.
// Usado inline em "Adicionar cardápio" (cardapio = null) e dentro do modal de
// edição em "Visualizar cardápio" (cardapio = linha existente, semana travada).
export function CardapioForm({
  cardapio,
  onSaved,
  onCancel,
}: {
  cardapio: CardapioRow | null
  onSaved: () => void
  onCancel?: () => void
}) {
  const queryClient = useQueryClient()
  const { data: fichas, isLoading: carregandoFichas } = useFichasTecnicas()

  const [semana, setSemana] = useState(cardapio?.semana_inicio ?? proximaSegunda(new Date()))
  const [pratos, setPratos] = useState<string[]>(() =>
    cardapio ? pratosPorIndice(cardapio.semana_inicio, cardapio.dias) : Array(7).fill(''),
  )
  const [observacoes, setObservacoes] = useState(cardapio?.observacoes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Só pratos de verdade: fichas técnicas PUBLICADAS da Cozinha (a ficha do
  // Bar é drink, e rascunho/inativa não é receita valendo).
  const pratosDisponiveis = useMemo(
    () => (fichas ?? []).filter((f) => f.setor === 'Cozinha' && f.status === 'publicada'),
    [fichas],
  )

  const dias = useMemo(() => diasDaSemana(semana), [semana])

  // Ao editar, um prato já salvo pode ter saído da lista (ficha apagada,
  // despublicada ou renomeada) — continua como opção, com o nome gravado, em
  // vez de a escolha sumir em silêncio.
  const nomeGravado = useMemo(() => new Map((cardapio?.dias ?? []).map((d) => [d.fichaTecnicaId, d.nome])), [cardapio])

  const nomeDaFicha = (id: string) =>
    pratosDisponiveis.find((f) => f.id === id)?.nome ?? nomeGravado.get(id) ?? ''

  const diasPreenchidos = pratos.filter(Boolean).length
  const isValid = diasPreenchidos > 0

  function escolher(indice: number, fichaId: string) {
    setPratos((ps) => ps.map((p, i) => (i === indice ? fichaId : p)))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isValid) return
    setError(null)
    setSubmitting(true)
    const diasSalvos: CardapioDia[] = dias
      .filter((d) => pratos[d.indice])
      .map((d) => ({ data: d.iso, fichaTecnicaId: pratos[d.indice], nome: nomeDaFicha(pratos[d.indice]) }))
    const input = { semanaInicio: semana, observacoes: observacoes.trim() || null, dias: diasSalvos }
    try {
      if (cardapio) await atualizarCardapio(cardapio.id, input)
      else await criarCardapio(input)
      await queryClient.invalidateQueries({ queryKey: CARDAPIOS_KEY })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar o cardápio.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field" style={{ maxWidth: 260 }}>
        <label>Semana (escolha qualquer dia dela) *</label>
        <input
          type="date"
          value={semana}
          disabled={!!cardapio}
          onChange={(e) => e.target.value && setSemana(segundaDaSemana(e.target.value))}
          required
        />
        <span className="field-hint">{tituloSemana(semana)}</span>
      </div>

      <h4 className="section-label">Prato de cada dia</h4>
      {!carregandoFichas && pratosDisponiveis.length === 0 && (
        <p className="field-hint" style={{ marginBottom: 12 }}>
          Nenhuma ficha técnica da Cozinha publicada ainda. Cadastre e publique o prato em Fichas Técnicas para poder
          escolhê-lo aqui.
        </p>
      )}

      <div className="manage-list" style={{ marginBottom: 16 }}>
        {dias.map((dia) => {
          const escolhido = pratos[dia.indice]
          const foraDaLista = escolhido && !pratosDisponiveis.some((f) => f.id === escolhido)
          return (
            <div className="manage-row" key={dia.iso} style={{ gap: 12, alignItems: 'center' }}>
              <div className="manage-row-info" style={{ minWidth: 170 }}>
                <strong>{dia.rotulo}</strong>
              </div>
              <select
                value={escolhido}
                onChange={(e) => escolher(dia.indice, e.target.value)}
                style={{ flex: 1, minWidth: 0 }}
                aria-label={`Prato de ${dia.rotulo}`}
              >
                <option value="">Sem prato neste dia</option>
                {foraDaLista && <option value={escolhido}>{nomeDaFicha(escolhido)} (indisponível)</option>}
                {pratosDisponiveis.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </div>
          )
        })}
      </div>

      <div className="field">
        <label>Observações</label>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={3}
          placeholder="Avisos da semana, trocas previstas..."
        />
      </div>

      {error && <p className="login-error">{error}</p>}
      <div className="modal-footer">
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={!isValid || submitting}>
          {submitting ? 'Salvando...' : cardapio ? 'Salvar alterações' : 'Adicionar cardápio'}
        </button>
      </div>
    </form>
  )
}
