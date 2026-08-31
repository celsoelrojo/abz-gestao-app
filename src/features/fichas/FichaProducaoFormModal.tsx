import { useMemo, useState, type FormEvent } from 'react'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabaseClient'
import { isoDate } from '../../lib/date'
import { useVinculoOptions, VINCULO_TIPOS, type VinculoTipo } from '../../lib/vinculo'
import { confirmar } from '../../store/confirmStore'
import { useEstoqueItens } from '../estoque/useEstoque'
import { FICHA_PRODUCAO_CATEGORIAS, FICHA_SETORES, PRODUCAO_CONDICOES_ARMAZENAMENTO, PRODUCAO_UNIDADES_RENDIMENTO } from './fichaConstants'
import { calcProducaoFichaCustoTotal, calcProducaoIngredienteCustoTotal } from './fichaHelpers'
import { deleteFichaImagem, fichaImagemUrl, uploadFichaImagem } from './fichaStorage'
import type {
  FichaProducaoRow,
  ProducaoCondicaoArmazenamento,
  ProducaoEtapa,
  ProducaoIngrediente,
  ProducaoRendimentoUnidade,
  ProducaoVinculo,
} from '../../types/database'

function novoIngrediente(): ProducaoIngrediente {
  return { id: crypto.randomUUID(), estoqueItemId: '', quantidade: null, custoUnitario: null, percentualPerda: null }
}

function novaEtapa(): ProducaoEtapa {
  return { id: crypto.randomUUID(), titulo: '', descricao: '', equipamento: null, imagens: [] }
}

// Formulário de entrada da Ficha de Produção — simplificado a pedido do
// usuário pros 5 grupos de campos abaixo (Identificação, Ingredientes, Modo
// de preparo, Validade e Rendimento, Informações complementares). Os muitos
// campos que existiam antes (Roteiro operacional, temperaturas, tempos
// detalhados, "Fichas Técnicas que usam esta produção" etc.) saíram do
// formulário, mas as colunas no banco continuam lá intactas — o payload só
// PARA de escrever nelas, nunca zera o que já existia numa ficha editada.
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

  // Identificação
  const [nome, setNome] = useState(ficha?.nome ?? '')
  const [setor, setSetor] = useState<'Bar' | 'Cozinha'>((ficha?.setor as 'Bar' | 'Cozinha') ?? lockedSetor ?? defaultSetor)
  const [categoria, setCategoria] = useState(ficha?.categoria ?? '')
  const [fotoPrincipalUrl, setFotoPrincipalUrl] = useState(ficha?.foto_principal_url ?? null)
  const [fotoPreviewUrl, setFotoPreviewUrl] = useState<string | null>(null)
  const [uploadingFoto, setUploadingFoto] = useState(false)

  // Ingredientes
  const [ingredientes, setIngredientes] = useState<ProducaoIngrediente[]>(ficha?.ingredientes ?? [])

  // Modo de preparo
  const [etapas, setEtapas] = useState<ProducaoEtapa[]>(ficha?.etapas ?? [])
  const [uploadingEtapaId, setUploadingEtapaId] = useState<string | null>(null)

  // Validade e rendimento
  const [prazoValidade, setPrazoValidade] = useState(ficha?.prazo_validade?.toString() ?? '')
  const [condicaoArmazenamento, setCondicaoArmazenamento] = useState<ProducaoCondicaoArmazenamento | ''>(
    ficha?.condicao_armazenamento ?? '',
  )
  const [qtdLotePadrao, setQtdLotePadrao] = useState(ficha?.qtd_lote_padrao?.toString() ?? '')
  const [unidadeRendimento, setUnidadeRendimento] = useState<ProducaoRendimentoUnidade | ''>(ficha?.unidade_rendimento ?? '')

  // Informações complementares
  const [alergenicos, setAlergenicos] = useState(ficha?.alergenicos ?? '')
  const [observacoesGerais, setObservacoesGerais] = useState(ficha?.observacoes_gerais ?? '')
  const [vinculos, setVinculos] = useState<ProducaoVinculo[]>(ficha?.vinculos ?? [])
  const [vinculoTipo, setVinculoTipo] = useState<VinculoTipo | ''>('')
  const [vinculoId, setVinculoId] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<'rascunho' | 'publicada' | null>(null)

  const { data: estoqueItens } = useEstoqueItens()
  const estoqueItensDoSetor = useMemo(() => (estoqueItens ?? []).filter((it) => it.categoria === setor), [estoqueItens, setor])
  const vinculoOptions = useVinculoOptions(vinculoTipo || null, setor, ficha?.id)

  const custoTotalReceita = useMemo(() => calcProducaoFichaCustoTotal(ingredientes), [ingredientes])

  function updateIngrediente(id: string, patch: Partial<ProducaoIngrediente>) {
    setIngredientes((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  }

  function updateEtapa(id: string, patch: Partial<ProducaoEtapa>) {
    setEtapas((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)))
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

  async function handleExcluirFoto() {
    if (!fotoPrincipalUrl) return
    if (!(await confirmar('Excluir a foto principal desta ficha?'))) return
    try {
      await deleteFichaImagem(fotoPrincipalUrl)
    } catch {
      // Se o arquivo já não existir no bucket, ainda assim tira a referência da ficha.
    }
    setFotoPrincipalUrl(null)
    setFotoPreviewUrl(null)
  }

  async function handleEtapaFotoSelected(etapaId: string, file: File | undefined) {
    if (!file) return
    setUploadingEtapaId(etapaId)
    try {
      const path = await uploadFichaImagem(setor, file)
      setEtapas((prev) => prev.map((e) => (e.id === etapaId ? { ...e, imagens: [...e.imagens, path] } : e)))
    } finally {
      setUploadingEtapaId(null)
    }
  }

  async function verFotoEtapa(path: string) {
    const url = await fichaImagemUrl(path)
    window.open(url, '_blank', 'noreferrer')
  }

  async function removerFotoEtapa(etapaId: string, path: string) {
    try {
      await deleteFichaImagem(path)
    } catch {
      // idem handleExcluirFoto
    }
    setEtapas((prev) => prev.map((e) => (e.id === etapaId ? { ...e, imagens: e.imagens.filter((p) => p !== path) } : e)))
  }

  function adicionarVinculo() {
    if (!vinculoTipo || !vinculoId) return
    if (vinculos.some((v) => v.tipo === vinculoTipo && v.id === vinculoId)) return
    if (vinculoTipo === 'Ficha de Produção' && ficha && vinculoId === ficha.id) return // nunca linkar a si mesma
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
        setor,
        categoria: categoria.trim() || null,
        foto_principal_url: fotoPrincipalUrl,
        ingredientes,
        etapas,
        prazo_validade: prazoValidade === '' ? null : Number(prazoValidade),
        // Pedido do usuário: "prazo de validade em dias" — sem seletor de
        // unidade no formulário, então grava sempre 'Dias'. registrar_producao_checklist
        // (SQL) precisa desse valor pra calcular a validade do lote.
        unidade_validade: 'Dias' as const,
        condicao_armazenamento: condicaoArmazenamento || null,
        qtd_lote_padrao: qtdLotePadrao === '' ? null : Number(qtdLotePadrao),
        unidade_rendimento: unidadeRendimento || null,
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <input type="file" accept="image/*" onChange={(e) => handleFotoSelected(e.target.files?.[0])} disabled={uploadingFoto} />
              {fotoPrincipalUrl && (
                <button type="button" className="btn btn-ghost" onClick={handleExcluirFoto}>
                  Excluir foto principal
                </button>
              )}
            </div>
            {uploadingFoto && <span className="field-hint">Enviando...</span>}
            {fotoPreviewUrl && <img src={fotoPreviewUrl} alt="" style={{ maxWidth: 160, marginTop: 8, borderRadius: 8 }} />}
          </div>

          <h4 className="section-label">Ingredientes</h4>
          <div className="manage-list">
            {ingredientes.map((ing) => {
              const item = estoqueItensDoSetor.find((it) => it.id === ing.estoqueItemId)
              return (
                <div className="manage-row" key={ing.id}>
                  <div className="manage-row-info" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                    <select value={ing.estoqueItemId} onChange={(e) => updateIngrediente(ing.id, { estoqueItemId: e.target.value })}>
                      <option value="">Produto...</option>
                      {estoqueItensDoSetor.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.title}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder={item ? `Quantidade (${item.unidade})` : 'Quantidade'}
                      value={ing.quantidade ?? ''}
                      onChange={(e) => updateIngrediente(ing.id, { quantidade: e.target.value === '' ? null : Number(e.target.value) })}
                    />
                    <input
                      type="number"
                      placeholder={item ? `Custo unitário (R$/${item.unidade})` : 'Custo unitário (R$)'}
                      value={ing.custoUnitario ?? ''}
                      onChange={(e) => updateIngrediente(ing.id, { custoUnitario: e.target.value === '' ? null : Number(e.target.value) })}
                    />
                    <input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="% de perda"
                      value={ing.percentualPerda ?? ''}
                      onChange={(e) => updateIngrediente(ing.id, { percentualPerda: e.target.value === '' ? null : Number(e.target.value) })}
                    />
                  </div>
                  <span className="task-meta">Custo total: R$ {calcProducaoIngredienteCustoTotal(ing).toFixed(2)}</span>
                  <div className="manage-row-actions">
                    <button type="button" className="icon-btn danger" onClick={() => setIngredientes((prev) => prev.filter((i) => i.id !== ing.id))}>
                      🗑
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => setIngredientes((prev) => [...prev, novoIngrediente()])}>
            + Adicionar ingrediente
          </button>
          {ingredientes.length > 0 && <p className="field-hint">Custo total da receita: R$ {custoTotalReceita.toFixed(2)}</p>}

          <h4 className="section-label">Modo de preparo</h4>
          <div className="manage-list">
            {etapas.map((et, i) => (
              <div className="manage-row" key={et.id}>
                <div className="manage-row-info">
                  <input placeholder="Título da etapa" value={et.titulo} onChange={(e) => updateEtapa(et.id, { titulo: e.target.value })} />
                  <textarea placeholder="Descrição" rows={2} value={et.descricao} onChange={(e) => updateEtapa(et.id, { descricao: e.target.value })} />
                  <input
                    placeholder="Equipamento usado"
                    value={et.equipamento ?? ''}
                    onChange={(e) => updateEtapa(et.id, { equipamento: e.target.value || null })}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleEtapaFotoSelected(et.id, e.target.files?.[0])}
                      disabled={uploadingEtapaId === et.id}
                    />
                    {uploadingEtapaId === et.id && <span className="field-hint">Enviando...</span>}
                    {et.imagens.map((path, idx) => (
                      <span className="account-badges" key={path}>
                        <button type="button" className="icon-btn" title="Ver foto" onClick={() => verFotoEtapa(path)}>
                          📷 {idx + 1}
                        </button>
                        <button type="button" className="icon-btn danger" title="Remover foto" onClick={() => removerFotoEtapa(et.id, path)}>
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="manage-row-actions">
                  <button type="button" className="icon-btn danger" onClick={() => setEtapas((prev) => prev.filter((x) => x.id !== et.id))}>
                    🗑
                  </button>
                </div>
                <span className="field-hint">Etapa {i + 1}</span>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => setEtapas((prev) => [...prev, novaEtapa()])}>
            + Adicionar etapa
          </button>

          <h4 className="section-label">Validade e Rendimento</h4>
          <div className="field-row">
            <div className="field">
              <label>Prazo de validade (dias)</label>
              <input type="number" min="0" value={prazoValidade} onChange={(e) => setPrazoValidade(e.target.value)} />
            </div>
            <div className="field">
              <label>Condição de armazenamento</label>
              <select
                value={condicaoArmazenamento}
                onChange={(e) => setCondicaoArmazenamento(e.target.value as ProducaoCondicaoArmazenamento)}
              >
                <option value="">Selecione...</option>
                {PRODUCAO_CONDICOES_ARMAZENAMENTO.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Rendimento</label>
              <input type="number" min="0" value={qtdLotePadrao} onChange={(e) => setQtdLotePadrao(e.target.value)} />
            </div>
            <div className="field">
              <label style={{ visibility: 'hidden' }}>Unidade do rendimento</label>
              <select value={unidadeRendimento} onChange={(e) => setUnidadeRendimento(e.target.value as ProducaoRendimentoUnidade)}>
                <option value="">Selecione a unidade...</option>
                {PRODUCAO_UNIDADES_RENDIMENTO.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
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
            <label>Vínculos (Mapa / POP / Ficha de Produção)</label>
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
                  setVinculoTipo(e.target.value as VinculoTipo | '')
                  setVinculoId('')
                }}
              >
                <option value="">Selecione o tipo...</option>
                {VINCULO_TIPOS.map((t) => (
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
