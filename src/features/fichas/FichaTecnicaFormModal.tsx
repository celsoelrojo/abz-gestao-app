import { useMemo, useState, type FormEvent } from 'react'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabaseClient'
import { isoDate } from '../../lib/date'
import { registrarTaxonomia, taxonomiaValores, useEstoqueItens, useTaxonomias } from '../estoque/useEstoque'
import { FICHA_VINCULO_TIPOS, useFichaVinculoOptions } from './useFichaVinculoOptions'
import { FICHA_SETORES } from './fichaConstants'
import { calcFichaCustos, calcIngredienteCustoTotal, calcIngredienteCustoUnitario } from './fichaHelpers'
import { fichaImagemUrl, uploadFichaImagem } from './fichaStorage'
import type { FichaIngredienteTecnica, FichaTecnicaRow, FichaVinculo, FichaVinculoTipo } from '../../types/database'

function novoIngrediente(): FichaIngredienteTecnica {
  return {
    id: crypto.randomUUID(),
    estoqueItemId: '',
    qtdBruta: null,
    qtdLiquida: null,
    fatorCorrecao: null,
    qtdBase: null,
    precoBase: null,
  }
}

// Junta o que já estava salvo em utensilios/equipamentos separados (fichas
// antigas) num único campo de edição — pedido do usuário pra unificar os
// dois. Ao salvar, o texto único vai só pra `equipamentos` (ver handleSave).
function juntarUtensiliosEquipamentos(ficha: FichaTecnicaRow | null): string {
  if (!ficha) return ''
  return [ficha.utensilios, ficha.equipamentos].filter(Boolean).join(' / ')
}

export function FichaTecnicaFormModal({
  ficha,
  defaultSetor,
  lockedSetor,
  onClose,
  onSaved,
}: {
  ficha: FichaTecnicaRow | null
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
  const [subcategoria, setSubcategoria] = useState(ficha?.subcategoria ?? '')
  const [fotoPrincipalUrl, setFotoPrincipalUrl] = useState(ficha?.foto_principal_url ?? null)
  const [fotoPreviewUrl, setFotoPreviewUrl] = useState<string | null>(null)
  const [uploadingFoto, setUploadingFoto] = useState(false)

  const [ingredientes, setIngredientes] = useState<FichaIngredienteTecnica[]>(ficha?.ingredientes ?? [])
  const [embalagem, setEmbalagem] = useState(ficha?.embalagem?.toString() ?? '')
  const [precoSugerido, setPrecoSugerido] = useState(ficha?.preco_sugerido?.toString() ?? '')

  const [etapas, setEtapas] = useState(ficha?.etapas ?? [])
  // Pedido do usuário: um único campo pra Utensílios + Equipamentos.
  const [utensiliosEquipamentos, setUtensiliosEquipamentos] = useState(juntarUtensiliosEquipamentos(ficha))
  const [padraoApresentacao, setPadraoApresentacao] = useState(ficha?.padrao_apresentacao ?? '')
  const [boasPraticas, setBoasPraticas] = useState(ficha?.boas_praticas ?? '')
  const [tempoPreparo, setTempoPreparo] = useState(ficha?.tempo_preparo ?? '')

  const [observacoesGerais, setObservacoesGerais] = useState(ficha?.observacoes_gerais ?? '')
  const [vinculos, setVinculos] = useState<FichaVinculo[]>(ficha?.vinculos ?? [])
  const [vinculoTipo, setVinculoTipo] = useState<FichaVinculoTipo | ''>('')
  const [vinculoId, setVinculoId] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<'rascunho' | 'publicada' | null>(null)

  const { data: taxonomias } = useTaxonomias('ficha_tecnica')
  const { data: estoqueItens } = useEstoqueItens()
  const estoqueItensDoSetor = useMemo(() => (estoqueItens ?? []).filter((it) => it.categoria === setor), [estoqueItens, setor])
  const categoriaOptions = useMemo(() => taxonomiaValores(taxonomias ?? [], setor, 'categoria'), [taxonomias, setor])
  const subcategoriaOptions = useMemo(
    () => taxonomiaValores(taxonomias ?? [], setor, 'subcategoria'),
    [taxonomias, setor],
  )
  const vinculoOptions = useFichaVinculoOptions(vinculoTipo || null, setor, ficha?.id)

  const custos = useMemo(
    () => calcFichaCustos(ingredientes, embalagem === '' ? null : Number(embalagem), precoSugerido === '' ? null : Number(precoSugerido)),
    [ingredientes, embalagem, precoSugerido],
  )

  function updateIngrediente(id: string, patch: Partial<FichaIngredienteTecnica>) {
    setIngredientes((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
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
    if (vinculoTipo === 'Ficha Técnica' && ficha && vinculoId === ficha.id) return // nunca linkar a si mesma
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
      const payload = {
        nome: nome.trim(),
        codigo: codigo.trim() || null,
        setor,
        categoria: categoria.trim() || null,
        subcategoria: subcategoria.trim() || null,
        foto_principal_url: fotoPrincipalUrl,
        ingredientes,
        embalagem: embalagem === '' ? null : Number(embalagem),
        preco_sugerido: precoSugerido === '' ? null : Number(precoSugerido),
        etapas,
        // Campo único (Utensílios + Equipamentos) grava só em `equipamentos`
        // — `utensilios` para de ser escrito (fica com o valor antigo, se
        // houver, mas não é mais editado nem lido por aqui).
        equipamentos: utensiliosEquipamentos.trim() || null,
        padrao_apresentacao: padraoApresentacao.trim() || null,
        boas_praticas: boasPraticas.trim() || null,
        tempo_preparo: tempoPreparo.trim() || null,
        observacoes_gerais: observacoesGerais.trim() || null,
        vinculos,
        status: target,
        ultima_revisao_em: now,
        ...(target === 'publicada' ? { publicado_por: profile?.nome ?? null, publicado_em: new Date().toISOString() } : {}),
      }

      await registrarTaxonomia('ficha_tecnica', setor, categoria, subcategoria)

      if (ficha) {
        const { error: updateError } = await supabase
          .from('fichas_tecnicas')
          .update({ ...payload, versao: ficha.versao + 1 })
          .eq('id', ficha.id)
        if (updateError) {
          setError(updateError.message)
          return
        }
      } else {
        const { error: insertError } = await supabase.from('fichas_tecnicas').insert({
          ...payload,
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
          <h3>{isEdit ? 'Editar Ficha Técnica' : 'Nova Ficha Técnica'}</h3>
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
              <input value={categoria} onChange={(e) => setCategoria(e.target.value)} list="ft-categoria-list" />
              <datalist id="ft-categoria-list">
                {categoriaOptions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="field">
              <label>Subcategoria</label>
              <input value={subcategoria} onChange={(e) => setSubcategoria(e.target.value)} list="ft-subcategoria-list" />
              <datalist id="ft-subcategoria-list">
                {subcategoriaOptions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="field">
            <label>Foto principal</label>
            <input type="file" accept="image/*" onChange={(e) => handleFotoSelected(e.target.files?.[0])} disabled={uploadingFoto} />
            {uploadingFoto && <span className="field-hint">Enviando...</span>}
            {fotoPreviewUrl && <img src={fotoPreviewUrl} alt="" style={{ maxWidth: 160, marginTop: 8, borderRadius: 8 }} />}
          </div>

          <h4 className="section-label">Ingredientes e custos</h4>
          <div className="manage-list">
            {ingredientes.map((ing) => {
              const item = estoqueItensDoSetor.find((it) => it.id === ing.estoqueItemId)
              return (
                <div className="manage-row" key={ing.id}>
                  <div className="manage-row-info" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
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
                      placeholder={item ? `Qtd bruta (${item.unidade})` : 'Qtd bruta'}
                      value={ing.qtdBruta ?? ''}
                      onChange={(e) => updateIngrediente(ing.id, { qtdBruta: e.target.value === '' ? null : Number(e.target.value) })}
                    />
                    <input
                      type="number"
                      placeholder="Qtd líquida"
                      value={ing.qtdLiquida ?? ''}
                      onChange={(e) => updateIngrediente(ing.id, { qtdLiquida: e.target.value === '' ? null : Number(e.target.value) })}
                    />
                    <input
                      type="number"
                      placeholder="Fator correção"
                      value={ing.fatorCorrecao ?? ''}
                      onChange={(e) => updateIngrediente(ing.id, { fatorCorrecao: e.target.value === '' ? null : Number(e.target.value) })}
                    />
                    <button type="button" className="icon-btn danger" onClick={() => setIngredientes((prev) => prev.filter((i) => i.id !== ing.id))}>
                      🗑
                    </button>
                  </div>
                  <div className="manage-row-info" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginTop: 6 }}>
                    <input
                      type="number"
                      placeholder="Qtd base (embalagem)"
                      value={ing.qtdBase ?? ''}
                      onChange={(e) => updateIngrediente(ing.id, { qtdBase: e.target.value === '' ? null : Number(e.target.value) })}
                    />
                    <input
                      type="number"
                      placeholder="Preço base (R$)"
                      value={ing.precoBase ?? ''}
                      onChange={(e) => updateIngrediente(ing.id, { precoBase: e.target.value === '' ? null : Number(e.target.value) })}
                    />
                    <span className="task-meta">
                      Custo unit.: R$ {calcIngredienteCustoUnitario(ing).toFixed(4)} · Total: R${' '}
                      {calcIngredienteCustoTotal(ing).toFixed(2)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => setIngredientes((prev) => [...prev, novoIngrediente()])}>
            + Adicionar ingrediente
          </button>

          <div className="field-row" style={{ marginTop: 12 }}>
            <div className="field">
              <label>Embalagem (R$)</label>
              <input type="number" value={embalagem} onChange={(e) => setEmbalagem(e.target.value)} />
            </div>
            <div className="field">
              <label>Preço de venda sugerido (R$)</label>
              <input type="number" value={precoSugerido} onChange={(e) => setPrecoSugerido(e.target.value)} />
            </div>
          </div>
          <p className="field-hint">
            Custo total da receita: R$ {custos.custoTotalReceita.toFixed(2)} · Lucro bruto:{' '}
            {custos.lucroBruto == null ? '—' : `R$ ${custos.lucroBruto.toFixed(2)}`} · Margem estimada:{' '}
            {custos.margemEstimada == null ? '—' : `${custos.margemEstimada.toFixed(1)}%`}
          </p>

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
                </div>
                <div className="manage-row-actions">
                  <button type="button" className="icon-btn danger" onClick={() => setEtapas((prev) => prev.filter((x) => x.id !== et.id))}>
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setEtapas((prev) => [...prev, { id: crypto.randomUUID(), titulo: '', descricao: '', imagens: [] }])}
          >
            + Adicionar etapa
          </button>

          <div className="field-row" style={{ marginTop: 12 }}>
            <div className="field">
              <label>Utensílios e Equipamentos</label>
              <input value={utensiliosEquipamentos} onChange={(e) => setUtensiliosEquipamentos(e.target.value)} />
            </div>
            <div className="field">
              <label>Tempo de preparo</label>
              <input value={tempoPreparo} onChange={(e) => setTempoPreparo(e.target.value)} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Padrão de apresentação</label>
              <textarea rows={2} value={padraoApresentacao} onChange={(e) => setPadraoApresentacao(e.target.value)} />
            </div>
            <div className="field">
              <label>Boas práticas</label>
              <textarea rows={2} value={boasPraticas} onChange={(e) => setBoasPraticas(e.target.value)} />
            </div>
          </div>

          <h4 className="section-label">Informações complementares</h4>
          <div className="field">
            <label>Observações gerais</label>
            <textarea rows={2} value={observacoesGerais} onChange={(e) => setObservacoesGerais(e.target.value)} />
          </div>

          <div className="field">
            <label>Vínculos (Mapa / POP / Ficha Técnica)</label>
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
                {FICHA_VINCULO_TIPOS.map((t) => (
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
