import { describe, expect, it } from 'vitest'
import {
  dataEmBrasilia,
  diaOperacionalIso,
  esc,
  mensagemConclusao,
  mensagemPendencias,
  pendentesDoDia,
  somarDiasIso,
  tarefaAgendadaEm,
  type TarefaDoDia,
} from '../../../supabase/functions/_shared/agenda'
import { isTaskScheduledOn } from './scheduling'
import type { ChecklistTaskRow, Periodicidade, Weekday } from '../../types/database'

const TODOS: Weekday[] = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']

function tarefa(p: Partial<ChecklistTaskRow>): ChecklistTaskRow {
  return { active: true, periodicidade: 'Diária', dias: TODOS, data_unica: null, semanas_do_mes: [], ...p } as ChecklistTaskRow
}

// A Edge Function não importa de src/: a regra de agenda foi copiada pra lá.
// Este teste garante que as duas cópias dão a mesma resposta.
describe('agenda da Edge Function = agenda do app', () => {
  const config: Partial<ChecklistTaskRow>[] = [
    {},
    { active: false },
    { periodicidade: 'Semanal', dias: ['Segunda', 'Quinta'] },
    { periodicidade: 'Mensal', dias: ['Sexta'], semanas_do_mes: ['1'] },
    { periodicidade: 'Mensal', dias: ['Sexta'], semanas_do_mes: ['ultima'] },
    { periodicidade: 'Quinzenal', dias: ['Quarta'], semanas_do_mes: ['2', '4'] },
    { periodicidade: 'Mensal', dias: ['Domingo'], semanas_do_mes: ['3', 'ultima'] },
    { periodicidade: 'Única' as Periodicidade, data_unica: '2026-11-17' },
  ]

  it('mesma resposta em 14 meses de datas, inclusive virada de mês, ano e fevereiro', () => {
    let data = '2026-01-01'
    for (let i = 0; i < 430; i++) {
      for (const c of config) {
        const t = tarefa(c)
        expect(tarefaAgendadaEm(t, data), `${data} ${JSON.stringify(c)}`).toBe(isTaskScheduledOn(t, new Date(`${data}T00:00:00`)))
      }
      data = somarDiasIso(data, 1)
    }
  })
})

describe('datas em Brasília', () => {
  it('converte o instante pra data local e vira o dia operacional às 5h', () => {
    expect(dataEmBrasilia('2026-11-03T01:30:00Z')).toBe('2026-11-02') // 22:30 do dia 2 em Brasília
    expect(diaOperacionalIso(new Date('2026-11-03T07:59:00Z'))).toBe('2026-11-02') // 04:59 ainda é o dia 2
    expect(diaOperacionalIso(new Date('2026-11-03T08:05:00Z'))).toBe('2026-11-03') // 05:05 já é o dia 3
  })
})

describe('pendentesDoDia', () => {
  const base = { active: true, periodicidade: 'Diária', dias: TODOS, data_unica: null, semanas_do_mes: [] }
  const t = (id: number, extra: Partial<TarefaDoDia> = {}): TarefaDoDia => ({
    ...base,
    id,
    title: `T${id}`,
    setor: 'Bar',
    created_at: '2026-10-01T12:00:00Z',
    ...extra,
  })

  it('lista o que estava agendado e sem conclusão no dia', () => {
    const r = pendentesDoDia([t(1), t(2), t(3, { active: false })], new Set([1]), '2026-11-02')
    expect(r.map((x) => x.id)).toEqual([2])
  })
  it('tarefa criada depois do dia não conta como pendente', () => {
    expect(pendentesDoDia([t(1, { created_at: '2026-11-05T12:00:00Z' })], new Set(), '2026-11-02')).toEqual([])
    expect(pendentesDoDia([t(1, { created_at: '2026-11-02T20:00:00Z' })], new Set(), '2026-11-02')).toHaveLength(1)
  })
})

describe('mensagens', () => {
  it('conclusão: escapa HTML, mostra quem/hora, atraso e foto', () => {
    const m = mensagemConclusao({ titulo: 'Limpar <bancada> & copos', setor: 'Bar', por: 'Maria', concluidaEm: '2026-11-02T21:42:00Z', diasAtraso: 2, comFoto: true })
    expect(m).toContain('Limpar &lt;bancada&gt; &amp; copos')
    expect(m).toContain('por Maria')
    expect(m).toContain('18:42')
    expect(m).toContain('2 dias de atraso')
    expect(m).toContain('📷')
    expect(mensagemConclusao({ titulo: 'x', setor: 'Bar', por: null, concluidaEm: '2026-11-02T21:42:00Z', diasAtraso: null, comFoto: false })).not.toContain('atraso')
  })

  it('pendências: agrupa por setor, mostra contagem e limita a lista', () => {
    const msg = mensagemPendencias('2026-11-02', { Bar: 8, Cozinha: 6 }, [
      { title: 'Limpar bancada', setor: 'Bar' },
      { title: 'Repor gelo', setor: 'Bar' },
    ])
    expect(msg).toContain('Pendências de seg 02/11')
    expect(msg).toContain('2 de 14 tarefas')
    expect(msg).toContain('<b>Bar</b> — 2 de 8')
    expect(msg).not.toContain('Cozinha')

    const muitas = Array.from({ length: 60 }, (_, i) => ({ title: `Tarefa ${i}`, setor: 'Bar' }))
    const grande = mensagemPendencias('2026-11-02', { Bar: 60 }, muitas)
    expect(grande).toContain('… e mais 20')
    expect(grande.length).toBeLessThan(4096)
  })

  it('tudo em dia e dia sem tarefas têm texto próprio', () => {
    expect(mensagemPendencias('2026-11-02', { Bar: 3 }, [])).toContain('Tudo em dia: 3 de 3')
    expect(mensagemPendencias('2026-11-02', {}, [])).toContain('Não havia tarefas')
  })

  it('esc troca os caracteres do HTML do Telegram', () => {
    expect(esc('a<b>&c')).toBe('a&lt;b&gt;&amp;c')
  })
})
