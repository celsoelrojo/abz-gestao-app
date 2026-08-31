import { useMemo, useState } from 'react'
import type { EstoqueItemRow, ProducaoIngrediente } from '../../types/database'

// Ferramenta só de leitura/preview — nunca grava na ficha salva (espelha
// updateProducaoCalculator do protótipo). Todas as linhas (Rendimento +
// cada ingrediente) partem do valor declarado na ficha e são editáveis: ao
// digitar em qualquer uma, a proporção (novo valor / valor original daquela
// linha) é aplicada a TODAS as outras — não é mais só "Rendimento manda em
// tudo", qualquer campo pode ser o gatilho.
interface LinhaCalculadora {
  id: string // 'rendimento' ou ingrediente.id
  label: string
  unidade: string
  original: number
}

export function ProducaoCalculadora({
  ingredientes,
  estoqueItens,
  qtdLotePadrao,
  unidadeRendimento,
}: {
  ingredientes: ProducaoIngrediente[]
  estoqueItens: EstoqueItemRow[]
  qtdLotePadrao: number | null
  unidadeRendimento: string | null
}) {
  const itemPorId = useMemo(() => new Map(estoqueItens.map((it) => [it.id, it])), [estoqueItens])

  const linhas = useMemo<LinhaCalculadora[]>(() => {
    const linhaRendimento: LinhaCalculadora = {
      id: 'rendimento',
      label: 'Rendimento',
      unidade: unidadeRendimento ?? '',
      original: Number(qtdLotePadrao) || 0,
    }
    const linhasIngredientes: LinhaCalculadora[] = ingredientes.map((ing) => {
      const item = itemPorId.get(ing.estoqueItemId)
      return {
        id: ing.id,
        label: item?.title ?? '(produto não encontrado)',
        unidade: item?.unidade ?? '',
        original: Number(ing.quantidade) || 0,
      }
    })
    return [linhaRendimento, ...linhasIngredientes]
  }, [ingredientes, itemPorId, qtdLotePadrao, unidadeRendimento])

  // Componente é remontado por `key={ficha.id}` no chamador quando a ficha
  // muda — o estado inicial abaixo já cobre a troca, sem precisar de efeito.
  const [valores, setValores] = useState<Record<string, string>>(() => valoresIniciais(linhas))

  function valoresIniciais(ls: LinhaCalculadora[]): Record<string, string> {
    return Object.fromEntries(ls.map((l) => [l.id, l.original > 0 ? formatar(l.original) : '']))
  }

  function handleChange(linhaId: string, texto: string) {
    const linha = linhas.find((l) => l.id === linhaId)
    const novoValor = Number(texto)
    if (!linha || texto.trim() === '' || !(novoValor >= 0) || linha.original <= 0) {
      // sem base pra calcular proporção (campo vazio, valor inválido, ou a
      // própria linha não tinha valor original) — só atualiza esse campo.
      setValores((prev) => ({ ...prev, [linhaId]: texto }))
      return
    }
    const ratio = novoValor / linha.original
    setValores(
      Object.fromEntries(
        linhas.map((l) => [l.id, l.id === linhaId ? texto : l.original > 0 ? formatar(l.original * ratio) : '']),
      ),
    )
  }

  function handleResetar() {
    setValores(valoresIniciais(linhas))
  }

  if (!qtdLotePadrao) {
    return <p className="field-hint">Configure o Rendimento na ficha (Validade e Rendimento) para habilitar a calculadora.</p>
  }

  return (
    <div>
      <p className="field-hint" style={{ marginBottom: 12 }}>
        Altere qualquer valor abaixo — os demais se ajustam na mesma proporção.
      </p>
      <div className="manage-list">
        {linhas.map((linha) => (
          <div className="manage-row" key={linha.id}>
            <div className="manage-row-info">
              <strong>{linha.label}</strong>
              {linha.unidade && <span>{linha.unidade}</span>}
            </div>
            <div className="manage-row-actions">
              <input
                type="number"
                step="any"
                min={0}
                style={{ width: 100 }}
                value={valores[linha.id] ?? ''}
                onChange={(e) => handleChange(linha.id, e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>
      <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={handleResetar}>
        Restaurar valores da ficha
      </button>
    </div>
  )
}

function formatar(n: number): string {
  return String(Math.round(n * 1000) / 1000)
}
