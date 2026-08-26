import { useMemo, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabaseClient'
import { isoDate } from '../../lib/date'
import { useEstoqueItens } from '../estoque/useEstoque'
import { useFichaVinculoOptions } from './useFichaVinculoOptions'
import {
  CONDICOES_ARMAZENAMENTO,
  FICHA_PRODUCAO_CATEGORIAS,
  FICHA_SETORES,
  FICHA_UNIDADES_SUGERIDAS,
  PRODUCAO_INGREDIENTE_TIPO_LABELS,
  UNIDADES_VALIDADE,
} from './fichaConstants'
import { fichaImagemUrl, uploadFichaImagem } from './fichaStorage'
import type {
  FichaProducaoRow,
  FichaVinculo,
  FichaVinculoTipo,
  ProducaoEtapa,
  ProducaoIngrediente,
  ProducaoIngredienteTipo,
} from '../../types/database'

const PRODUCAO_VINCULO_TIPOS: Extract<FichaVinculoTipo, 'Mapa' | 'POP'>[] = ['Mapa', 'POP']

function novoIngrediente(): ProducaoIngrediente {
  return {
    id: crypto.randomUUID(),
    nome: '',
    unidade: 'Quilo',
    qtdLotePadrao: null,
    qtdAjustada: null,
    perdas: null,
    observacoes: null,
    substituicoes: null,
    estoqueItemId: null,
    tipo: 'secundario',
    custoUnitario: null,
  }
}

function novaEtapa(): ProducaoEtapa {
  return {
    id: crypto.randomUUID(),
    titulo: '',
    descricao: '',
    tempo: null,
    temperatura: null,
    equipamento: null,
    utensilios: null,
    pontoControle: null,
    imagens: [],
  }
}

export function FichaProducaoFormModal({
  ficha,
  defaultSetor,
  lockedSetor,
  onClose,
  onSaved,
}: {
  ficha: FichaProducaoRow | null
  defaultSetor: 'Bar' | 'Cozinha'
  lockedSetor: 'Bar' | 'Cozinha' | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const profile = useAuthStore((s) => s.profile)
  const isEdit = !!ficha

  const [nome, setNome] = useState(ficha?.nome ?? '')
  const [codigo, setCodigo] = useState(ficha?.codigo ?? '')
  const [setor, setSetor] = useState<'Bar' | 'Cozinha'>((ficha?.setor as 'Bar' | 'Cozinha') ?? lockedSetor ?? defaultSetor)
  const [categoria, setCategoria] = useState(ficha?.categoria ?? '')
  const [fotoPrincipalUrl, setFotoPrincipalUrl] = useState(ficha?.foto_principal_url ?? null)
  const [fotoPreviewUrl, setFotoPreviewUrl] = useState<string | null>(null)
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const [fichasTecnicasVinculadas, setFichasTecnicasVinculadas] = useState<string[]>(ficha?.fichas_tecnicas_vinculadas ?? [])

  const [qtdLotePadrao, setQtdLotePadrao] = useState(ficha?.qtd_lote_padrao?.toString() ?? '')
  const [unidadeRendimento, setUnidadeRendimento] = useState(ficha?.unidade_rendimento ?? '')
  const [qtdPorcoesUnidades, setQtdPorcoesUnidades] = useState(ficha?.qtd_porcoes_unidades?.toString() ?? '')
  const [tempoPrePreparo, setTempoPrePreparo] = useState(ficha?.tempo_pre_preparo ?? '')
  const [tempoPreparo, setTempoPreparo] = useState(ficha?.tempo_preparo ?? '')
  const [tempoDescanso, setTempoDescanso] = useState(ficha?.tempo_descanso ?? '')
  const [tempoResfriamento, setTempoResfriamento] = useState(ficha?.tempo_resfriamento ?? '')
  const [tempoTotal, setTempoTotal] = useState(ficha?.tempo_total ?? '')
  const [podeSerFracionada, setPodeSerFracionada] = useState(ficha?.pode_ser_fracionada ?? false)

  const [ingredientes, setIngredientes] = useState<ProducaoIngrediente[]>(ficha?.ingredientes ?? [])
  const [etapas, setEtapas] = useState<ProducaoEtapa[]>(ficha?.etapas ?? [])

  const [higienizacao, setHigienizacao] = useState(ficha?.higienizacao ?? '')
  const [epis, setEpis] = useState(ficha?.epis ?? '')
  const [cuidadosManipulacao, setCuidadosManipulacao] = useState(ficha?.cuidados_manipulacao ?? '')
  const [padraoEsperado, setPadraoEsperado] = useState(ficha?.padrao_esperado ?? '')
  const [criteriosAprovacao, setCriteriosAprovacao] = useState(ficha?.criterios_aprovacao ?? '')
  const [acoesCorretivas, setAcoesCorretivas] = useState(ficha?.acoes_corretivas ?? '')

  const [prazoValidade, setPrazoValidade] = useState(ficha?.prazo_validade?.toString() ?? '')
  const [unidadeValidade, setUnidadeValidade] = useState(ficha?.unidade_validade ?? 'Dias')
  const [condicaoArmazenamento, setCondicaoArmazenamento] = useState(ficha?.condicao_armazenamento ?? '')
  const [tempMin, setTempMin] = useState(ficha?.temp_min?.toString() ?? '')
  const [tempMax, setTempMax] = useState(ficha?.temp_max?.toString() ?? '')
  const [tipoRecipiente, setTipoRecipiente] = useState(ficha?.tipo_recipiente ?? '')
  const [qtdRecipientes, setQtdRecipientes] = useState(ficha?.qtd_recipientes ?? '')
  const [validadeAposAberto, setValidadeAposAberto] = useState(ficha?.validade_apos_aberto ?? '')
  const [validadeAposDescongelamento, setValidadeAposDescongelamento] = useState(ficha?.validade_apos_descongelamento ?? '')
  const [instrucoesEtiqueta, setInstrucoesEtiqueta] = useState(ficha?.instrucoes_etiqueta ?? '')
  const [instrucoesDescarte, setInstrucoesDescarte] = useState(ficha?.instrucoes_descarte ?? '')

  const [alergenicos, setAlergenicos] = useState(ficha?.alergenicos ?? '')
  const [observacoesGerais, setObservacoesGerais] = useState(ficha?.observacoes_gerais ?? '')
  const [vinculos, setVinculos] = useState<FichaVinculo[]>(ficha?.vinculos ?? [])
  const [vinculoTipo, setVinculoTipo] = useState<FichaVinculoTipo | ''>('')
  const [vinculoId, setVinculoId] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<'rascunho' | 'publicada' | null>(null)

  const { data: estoqueItens } = useEstoqueItens()
  const estoqueItensDoSetor = useMemo(() => (estoqueItens ?? []).filter((it) => it.categoria === setor), [estoqueItens, setor])
  const vinculoOptions = useFichaVinculoOptions(vinculoTipo || null, setor)

  const { data: fichasTecnicasDisponiveis } = useQuery({
    queryKey: ['fichas_tecnicas_publicadas', setor],
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('fichas_tecnicas')
        .select('id, nome')
        .eq('status', 'publicada')
        .eq('setor', setor)
      if (qError) throw qError
      return data as { id: string; nome: string }[]
    },
  })

  function updateIngrediente(id: string, patch: Partial<ProducaoIngrediente>) {
    setIngredientes((prev) =>
      prev.map((i) => {
        if (i.id !== id) {
          // Só um ingrediente pode ser "base" por vez — marcar outro como
          // base rebaixa automaticamente o anterior.
          if (patch.tipo === 'base' && i.tipo === 'base') return { ...i, tipo: 'secundario' }
          return i
        }
        return { ...i, ...patch }
      }),
    )
  }

  async function handleFotoSelected(file: File | undefined) {
    if (!file) return
    setUploadingFoto(true)
    try {
      const path = await uploadFichaImagem(setor, file)
      setFotoPrincipalUrl(path)
      setFotoPreviewUrl(await fichaImagemUrl(path))
    } finally {
      setUploadingFoto(false)
    }
  }

  function adicionarVinculo() {
    if (!vinculoTipo || !vinculoId) return
    if (vinculos.some((v) => v.tipo === vinculoTipo && v.id === vinculoId)) return
    setVinculos((prev) => [...prev, { tipo: vinculoTipo, id: vinculoId }])
    setVinculoId('')
  }

  const isValid = !!nome.trim() && !!setor

  async function handleSave(target: 'rascunho' | 'publicada', e: FormEvent) {
    e.preventDefault()
    if (!isValid) return
    setError(null)
    setSubmitting(target)
    try {
      const now = isoDate(new Date())
      const historicoTipo = !ficha ? ('criacao' as const) : ('revisao' as const)
      const historicoEntry = { data: new Date().toISOString(), tipo: historicoTipo, autor: profile?.nome ?? 'Desconhecido' }

      const payload = {
        nome: nome.trim(),
        codigo: codigo.trim() || null,
        setor,
        categoria: categoria.trim() || null,
        foto_principal_url: fotoPrincipalUrl,
        fichas_tecnicas_vinculadas: fichasTecnicasVinculadas,
        ingredientes,
        etapas,
        prazo_validade: prazoValidade === '' ? null : Number(prazoValidade),
        unidade_validade: unidadeValidade,
        condicao_armazenamento: condicaoArmazenamento.trim() || null,
        temp_min: tempMin === '' ? null : Number(tempMin),
        temp_max: tempMax === '' ? null : Number(tempMax),
        tipo_recipiente: tipoRecipiente.trim() || null,
        qtd_recipientes: qtdRecipientes.trim() || null,
        validade_apos_aberto: validadeAposAberto.trim() || null,
        validade_apos_descongelamento: validadeAposDescongelamento.trim() || null,
        instrucoes_etiqueta: instrucoesEtiqueta.trim() || null,
        instrucoes_descarte: instrucoesDescarte.trim() || null,
        qtd_lote_padrao: qtdLotePadrao === '' ? null : Number(qtdLotePadrao),
        unidade_rendimento: unidadeRendimento.trim() || null,
        qtd_porcoes_unidades: qtdPorcoesUnidades === '' ? null : Number(qtdPorcoesUnidades),
        tempo_pre_preparo: tempoPrePreparo.trim() || null,
        tempo_preparo: tempoPreparo.trim() || null,
        tempo_descanso: tempoDescanso.trim() || null,
        tempo_resfriamento: tempoResfriamento.trim() || null,
        tempo_total: tempoTotal.trim() || null,
        pode_ser_fracionada: podeSerFracionada,
        higienizacao: higienizacao.trim() || null,
        epis: epis.trim() || null,
        cuidados_manipulacao: cuidadosManipulacao.trim() || null,
        padrao_esperado: padraoEsperado.trim() || null,
        criterios_aprovacao: criteriosAprovacao.trim() || null,
        acoes_corretivas: acoesCorretivas.trim() || null,
        alergenicos: alergenicos.trim() || null,
        observacoes_gerais: observacoesGerais.trim() || null,
        vinculos,
        status: target,
        ultima_revisao_em: now,
        ...(target === 'publicada' ? { publicado_por: profile?.nome ?? null, publicado_em: new Date().toISOString() } : {}),
      }

      if (ficha) {
        const historico = target === 'publicada' ? [...ficha.historico, historicoEntry, { ...historicoEntry, tipo: 'publicacao' as const }] : [...ficha.historico, historicoEntry]
        const { error: updateError } = await supabase
          .from('fichas_producao')
          .update({ ...payload, versao: ficha.versao + 1, historico })
          .eq('id', ficha.id)
        if (updateError) {
          setError(updateError.message)
          return
        }
      } else {
        const historico =
          target === 'publicada' ? [historicoEntry, { ...historicoEntry, tipo: 'publicacao' as const }] : [historicoEntry]
        const { error: insertError } = await supabase.from('fichas_producao').insert({
          ...payload,
          historico,
          criado_por: profile?.nome ?? null,
          criado_em: now,
        })
        if (insertError) {
          setError(insertError.message)
          return
        }
      }
      await onSaved()
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal modal-wide">
        <div className="modal-header">
          <h3>{isEdit ? 'Editar Ficha de Produção' : 'Nova Ficha de Produção'}</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <form className="modal-body" onSubmit={(e) => handleSave('rascunho', e)}>
          <h4 className="section-label">Identificação</h4>
          <div className="field-row">
            <div className="field">
              <label>Nome *</label>
              <input value={nome} onChange={(e) => setNome(e.target.value)} required />
            </div>
            <div className="field">
              <label>Código interno</label>
              <input value={codigo} onChange={(e) => setCodigo(e.target.value)} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Setor *</label>
              <select value={setor} onChange={(e) => setSetor(e.target.value as 'Bar' | 'Cozinha')} disabled={!!lockedSetor}>
                {FICHA_SETORES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Categoria</label>
              <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                <option value="">Selecione...</option>
                {FICHA_PRODUCAO_CATEGORIAS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Foto principal</label>
            <input type="file" accept="image/*" onChange={(e) => handleFotoSelected(e.target.files?.[0])} disabled={uploadingFoto} />
            {uploadingFoto && <span className="field-hint">Enviando...</span>}
            {fotoPreviewUrl && <img src={fotoPreviewUrl} alt="" style={{ maxWidth: 160, marginTop: 8, borderRadius: 8 }} />}
          </div>

          <div className="field">
            <label>Fichas Técnicas que usam esta produção</label>
            <div className="account-badges" style={{ marginBottom: 8 }}>
              {fichasTecnicasVinculadas.map((id) => {
                const f = fichasTecnicasDisponiveis?.find((ft) => ft.id === id)
                return (
                  <span className="badge-status badge-status-pendente" key={id}>
                    {f?.nome ?? id}
                    <button
                      type="button"
                      onClick={() => setFichasTecnicasVinculadas((prev) => prev.filter((x) => x !== id))}
                      style={{ marginLeft: 6, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  </span>
                )
              })}
            </div>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) setFichasTecnicasVinculadas((prev) => [...prev, e.target.value])
              }}
            >
              <option value="">+ Vincular ficha técnica...</option>
              {(fichasTecnicasDisponiveis ?? [])
                .filter((f) => !fichasTecnicasVinculadas.includes(f.id))
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
            </select>
          </div>

          <h4 className="section-label">Produção em volume</h4>
          <div className="field-row">
            <div className="field">
              <label>Quantidade do lote padrão</label>
              <input type="number" value={qtdLotePadrao} onChange={(e) => setQtdLotePadrao(e.target.value)} />
            </div>
            <div className="field">
              <label>Unidade de rendimento</label>
              <input value={unidadeRendimento} onChange={(e) => setUnidadeRendimento(e.target.value)} />
            </div>
            <div className="field">
              <label>Qtd. porções/unidades</label>
              <input type="number" value={qtdPorcoesUnidades} onChange={(e) => setQtdPorcoesUnidades(e.target.value)} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Tempo pré-preparo</label>
              <input value={tempoPrePreparo} onChange={(e) => setTempoPrePreparo(e.target.value)} />
            </div>
            <div className="field">
              <label>Tempo preparo</label>
              <input value={tempoPreparo} onChange={(e) => setTempoPreparo(e.target.value)} />
            </div>
            <div className="field">
              <label>Tempo descanso</label>
              <input value={tempoDescanso} onChange={(e) => setTempoDescanso(e.target.value)} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Tempo resfriamento</label>
              <input value={tempoResfriamento} onChange={(e) => setTempoResfriamento(e.target.value)} />
            </div>
            <div className="field">
              <label>Tempo total</label>
              <input value={tempoTotal} onChange={(e) => setTempoTotal(e.target.value)} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24 }}>
              <input type="checkbox" checked={podeSerFracionada} onChange={(e) => setPodeSerFracionada(e.target.checked)} />
              Pode ser fracionada
            </label>
          </div>

          <h4 className="section-label">Ingredientes</h4>
          <div className="manage-list">
            {ingredientes.map((ing) => (
              <div className="manage-row" key={ing.id}>
                <div className="manage-row-info" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                  <input placeholder="Nome" value={ing.nome} onChange={(e) => updateIngrediente(ing.id, { nome: e.target.value })} />
                  <input
                    placeholder="Unidade"
                    value={ing.unidade}
                    onChange={(e) => updateIngrediente(ing.id, { unidade: e.target.value })}
                    list="fp-unidade-list"
                  />
                  <input
                    type="number"
                    placeholder="Qtd lote padrão"
                    value={ing.qtdLotePadrao ?? ''}
                    onChange={(e) => updateIngrediente(ing.id, { qtdLotePadrao: e.target.value === '' ? null : Number(e.target.value) })}
                  />
                  <select
                    value={ing.tipo}
                    onChange={(e) => updateIngrediente(ing.id, { tipo: e.target.value as ProducaoIngredienteTipo })}
                  >
                    {(Object.keys(PRODUCAO_INGREDIENTE_TIPO_LABELS) as ProducaoIngredienteTipo[]).map((t) => (
                      <option key={t} value={t}>
                        {PRODUCAO_INGREDIENTE_TIPO_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="manage-row-info" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginTop: 6 }}>
                  <input
                    type="number"
                    placeholder="Custo unitário (R$)"
                    value={ing.custoUnitario ?? ''}
                    onChange={(e) => updateIngrediente(ing.id, { custoUnitario: e.target.value === '' ? null : Number(e.target.value) })}
                  />
                  <select
                    value={ing.estoqueItemId ?? ''}
                    onChange={(e) => updateIngrediente(ing.id, { estoqueItemId: e.target.value || null })}
                  >
                    <option value="">Sem item de estoque vinculado</option>
                    {estoqueItensDoSetor.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.title}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="Perdas"
                    value={ing.perdas ?? ''}
                    onChange={(e) => updateIngrediente(ing.id, { perdas: e.target.value || null })}
                  />
                  <input
                    placeholder="Substituições"
                    value={ing.substituicoes ?? ''}
                    onChange={(e) => updateIngrediente(ing.id, { substituicoes: e.target.value || null })}
                  />
                </div>
                <div className="manage-row-actions">
                  <button type="button" className="icon-btn danger" onClick={() => setIngredientes((prev) => prev.filter((i) => i.id !== ing.id))}>
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
          <datalist id="fp-unidade-list">
            {FICHA_UNIDADES_SUGERIDAS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
          <button type="button" className="btn btn-ghost" onClick={() => setIngredientes((prev) => [...prev, novoIngrediente()])}>
            + Adicionar ingrediente
          </button>

          <h4 className="section-label">Modo de preparo</h4>
          <div className="manage-list">
            {etapas.map((et) => (
              <div className="manage-row" key={et.id}>
                <div className="manage-row-info">
                  <input
                    placeholder="Título da etapa"
                    value={et.titulo}
                    onChange={(e) => setEtapas((prev) => prev.map((x) => (x.id === et.id ? { ...x, titulo: e.target.value } : x)))}
                  />
                  <textarea
                    placeholder="Descrição"
                    rows={2}
                    value={et.descricao}
                    onChange={(e) => setEtapas((prev) => prev.map((x) => (x.id === et.id ? { ...x, descricao: e.target.value } : x)))}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                    <input
                      placeholder="Tempo"
                      value={et.tempo ?? ''}
                      onChange={(e) => setEtapas((prev) => prev.map((x) => (x.id === et.id ? { ...x, tempo: e.target.value || null } : x)))}
                    />
                    <input
                      placeholder="Temperatura"
                      value={et.temperatura ?? ''}
                      onChange={(e) => setEtapas((prev) => prev.map((x) => (x.id === et.id ? { ...x, temperatura: e.target.value || null } : x)))}
                    />
                    <input
                      placeholder="Equipamento"
                      value={et.equipamento ?? ''}
                      onChange={(e) => setEtapas((prev) => prev.map((x) => (x.id === et.id ? { ...x, equipamento: e.target.value || null } : x)))}
                    />
                    <input
                      placeholder="Ponto de controle"
                      value={et.pontoControle ?? ''}
                      onChange={(e) =>
                        setEtapas((prev) => prev.map((x) => (x.id === et.id ? { ...x, pontoControle: e.target.value || null } : x)))
                      }
                    />
                  </div>
                </div>
                <div className="manage-row-actions">
                  <button type="button" className="icon-btn danger" onClick={() => setEtapas((prev) => prev.filter((x) => x.id !== et.id))}>
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => setEtapas((prev) => [...prev, novaEtapa()])}>
            + Adicionar etapa
          </button>

          <h4 className="section-label">Roteiro operacional</h4>
          <div className="field-row">
            <div className="field">
              <label>Higienização</label>
              <textarea rows={2} value={higienizacao} onChange={(e) => setHigienizacao(e.target.value)} />
            </div>
            <div className="field">
              <label>EPIs</label>
              <textarea rows={2} value={epis} onChange={(e) => setEpis(e.target.value)} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Cuidados de manipulação</label>
              <textarea rows={2} value={cuidadosManipulacao} onChange={(e) => setCuidadosManipulacao(e.target.value)} />
            </div>
            <div className="field">
              <label>Padrão esperado</label>
              <textarea rows={2} value={padraoEsperado} onChange={(e) => setPadraoEsperado(e.target.value)} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Critérios de aprovação</label>
              <textarea rows={2} value={criteriosAprovacao} onChange={(e) => setCriteriosAprovacao(e.target.value)} />
            </div>
            <div className="field">
              <label>Ações corretivas</label>
              <textarea rows={2} value={acoesCorretivas} onChange={(e) => setAcoesCorretivas(e.target.value)} />
            </div>
          </div>

          <h4 className="section-label">Validade</h4>
          <div className="field-row">
            <div className="field">
              <label>Prazo de validade</label>
              <input type="number" value={prazoValidade} onChange={(e) => setPrazoValidade(e.target.value)} />
            </div>
            <div className="field">
              <label>Unidade</label>
              <select value={unidadeValidade ?? 'Dias'} onChange={(e) => setUnidadeValidade(e.target.value as (typeof UNIDADES_VALIDADE)[number])}>
                {UNIDADES_VALIDADE.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Condição de armazenamento</label>
              <select value={condicaoArmazenamento} onChange={(e) => setCondicaoArmazenamento(e.target.value)}>
                <option value="">Selecione...</option>
                {CONDICOES_ARMAZENAMENTO.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Temp. mínima (°C)</label>
              <input type="number" value={tempMin} onChange={(e) => setTempMin(e.target.value)} />
            </div>
            <div className="field">
              <label>Temp. máxima (°C)</label>
              <input type="number" value={tempMax} onChange={(e) => setTempMax(e.target.value)} />
            </div>
            <div className="field">
              <label>Tipo de recipiente</label>
              <input value={tipoRecipiente} onChange={(e) => setTipoRecipiente(e.target.value)} />
            </div>
            <div className="field">
              <label>Qtd. recipientes</label>
              <input value={qtdRecipientes} onChange={(e) => setQtdRecipientes(e.target.value)} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Validade após aberto</label>
              <input value={validadeAposAberto} onChange={(e) => setValidadeAposAberto(e.target.value)} />
            </div>
            <div className="field">
              <label>Validade após descongelamento</label>
              <input value={validadeAposDescongelamento} onChange={(e) => setValidadeAposDescongelamento(e.target.value)} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Instruções de etiqueta</label>
              <textarea rows={2} value={instrucoesEtiqueta} onChange={(e) => setInstrucoesEtiqueta(e.target.value)} />
            </div>
            <div className="field">
              <label>Instruções de descarte</label>
              <textarea rows={2} value={instrucoesDescarte} onChange={(e) => setInstrucoesDescarte(e.target.value)} />
            </div>
          </div>

          <h4 className="section-label">Informações complementares</h4>
          <div className="field-row">
            <div className="field">
              <label>Alergênicos</label>
              <textarea rows={2} value={alergenicos} onChange={(e) => setAlergenicos(e.target.value)} />
            </div>
            <div className="field">
              <label>Observações gerais</label>
              <textarea rows={2} value={observacoesGerais} onChange={(e) => setObservacoesGerais(e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>Vínculos (Mapa / POP)</label>
            <div className="account-badges" style={{ marginBottom: 8 }}>
              {vinculos.map((v, i) => (
                <span className="badge-status badge-status-pendente" key={`${v.tipo}-${v.id}-${i}`}>
                  {v.tipo}
                  <button
                    type="button"
                    onClick={() => setVinculos((prev) => prev.filter((_, idx) => idx !== i))}
                    style={{ marginLeft: 6, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
            <div className="field-row">
              <select
                value={vinculoTipo}
                onChange={(e) => {
                  setVinculoTipo(e.target.value as FichaVinculoTipo | '')
                  setVinculoId('')
                }}
              >
                <option value="">Selecione o tipo...</option>
                {PRODUCAO_VINCULO_TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <select value={vinculoId} onChange={(e) => setVinculoId(e.target.value)} disabled={!vinculoTipo}>
                <option value="">Selecione...</option>
                {vinculoOptions.data?.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.title}
                    {opt.sub ? ` (${opt.sub})` : ''}
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn-ghost" onClick={adicionarVinculo} disabled={!vinculoTipo || !vinculoId}>
                + Vincular
              </button>
            </div>
          </div>

          {error && <p className="login-error">{error}</p>}

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-ghost" disabled={!isValid || !!submitting}>
              {submitting === 'rascunho' ? 'Salvando...' : 'Salvar rascunho'}
            </button>
            <button type="button" className="btn btn-primary" disabled={!isValid || !!submitting} onClick={(e) => handleSave('publicada', e as unknown as FormEvent)}>
              {submitting === 'publicada' ? 'Publicando...' : 'Publicar ficha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
