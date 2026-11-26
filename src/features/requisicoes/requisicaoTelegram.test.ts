import { describe, expect, it } from 'vitest'
import {
  LIMITE_MENSAGEM,
  mensagemNovaRequisicao,
  mensagensRequisicoesAbertas,
  type RequisicaoAviso,
} from '../../../supabase/functions/_shared/requisicoes'

const base: RequisicaoAviso = {
  tipo: 'conserto',
  titulo: 'Ventilador quebrou',
  descricao: null,
  urgencia: 'media',
  status: 'pendente',
  solicitante_nome: 'Ana',
  setor: 'Bar',
  foto_path: null,
  created_at: '2026-11-23T15:00:00Z',
}
const agora = new Date('2026-11-26T08:00:00Z')

describe('avisos de requisição no Telegram', () => {
  it('nova requisição traz tipo, urgência e autor, escapando HTML', () => {
    const texto = mensagemNovaRequisicao({ ...base, titulo: 'Lixo <novo> & balde', urgencia: 'alta', descricao: 'Rachou', foto_path: 'x.jpg' })
    expect(texto).toContain('Nova requisição — Conserto')
    expect(texto).toContain('Lixo &lt;novo&gt; &amp; balde')
    expect(texto).toContain('Alta')
    expect(texto).toContain('Ana (Bar)')
    expect(texto).toContain('Rachou')
    expect(texto).toContain('Com foto')
  })

  it('lista pendentes e aprovadas, ignora concluídas e recusadas', () => {
    const [texto, ...resto] = mensagensRequisicoesAbertas(
      [
        base,
        { ...base, titulo: 'Copo', status: 'aprovada' },
        { ...base, titulo: 'Feita', status: 'concluida' },
        { ...base, titulo: 'Negada', status: 'recusada' },
      ],
      agora,
    )
    expect(resto).toHaveLength(0)
    expect(texto).toContain('2 requisições ainda não foram feitas.')
    expect(texto).toContain('Ventilador quebrou')
    expect(texto).toContain('Aprovadas, ainda não concluídas')
    expect(texto).toContain('há 3 dias')
    expect(texto).not.toContain('Feita')
    expect(texto).not.toContain('Negada')
  })

  it('urgência alta vem primeiro', () => {
    const [texto] = mensagensRequisicoesAbertas(
      [
        { ...base, titulo: 'Calma', urgencia: 'baixa' },
        { ...base, titulo: 'Urgente', urgencia: 'alta' },
      ],
      agora,
    )
    expect(texto.indexOf('Urgente')).toBeLessThan(texto.indexOf('Calma'))
  })

  it('sem nada em aberto avisa que está em dia', () => {
    expect(mensagensRequisicoesAbertas([{ ...base, status: 'concluida' }], agora)[0]).toContain('Nenhuma requisição em aberto')
  })

  it('lista grande é dividida sem perder nenhuma', () => {
    const muitas = Array.from({ length: 150 }, (_, i) => ({ ...base, titulo: `Item numero ${i}.` }))
    const mensagens = mensagensRequisicoesAbertas(muitas, agora)
    expect(mensagens.length).toBeGreaterThan(1)
    for (const m of mensagens) expect(m.length).toBeLessThanOrEqual(LIMITE_MENSAGEM)
    const tudo = mensagens.join('\n')
    for (let i = 0; i < 150; i++) expect(tudo).toContain(`Item numero ${i}.`)
  })
})
