import { useMemo, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabaseClient'
import { isoDate } from '../../lib/date'
import { registrarTaxonomia, taxonomiaValores, useTaxonomias } from '../estoque/useEstoque'
import { POP_SETORES, type PopSetor } from './popConstants'
import { usePopCategories } from './usePops'
import { POP_VINCULO_TIPOS, usePopVinculoOptions } from './usePopVinculoOptions'
import { uploadPopAnexo } from './popStorage'
import type {
  PopAcaoCorretiva,
  PopAnexo,
  PopEtapa,
  PopMaterial,
  PopResponsabilidade,
  PopRow,
  PopVinculo,
  PopVinculoTipo,
} from '../../types/database'

function novaEtapa(): PopEtapa {
  return { titulo: '', descricao: '', tempo: null, temperatura: null, frequencia: null, observacao: null, foto_url: null }
}

export function PopFormModal({
  pop,
  defaultSetor,
  lockedSetor,
  onClose,
  onSaved,
}: {
  pop: PopRow | null
  defaultSetor: PopSetor
  lockedSetor: PopSetor | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const profile = useAuthStore((s) => s.profile)
  const isEdit = !!pop

  const [titulo, setTitulo] = useState(pop?.titulo ?? '')
  const [codigo, setCodigo] = useState(pop?.codigo ?? '')
  const [setor, setSetor] = useState<PopSetor>(pop?.setor ?? lockedSetor ?? defaultSetor)
  const [categoryId, setCategoryId] = useState(pop?.category_id ?? '')
  const [subcategoria, setSubcategoria] = useState(pop?.subcategoria ?? '')
  const [estabelecimento, setEstabelecimento] = useState(pop?.estabelecimento ?? 'Abrazo Drink Bar')
  const [elaboradoPor, setElaboradoPor] = useState(pop?.elaborado_por ?? profile?.nome ?? '')
  const [aprovadoPor, setAprovadoPor] = useState(pop?.aprovado_por ?? '')
  const [dataEmissao, setDataEmissao] = useState(pop?.data_emissao ?? isoDate(new Date()))
  const [proximaRevisao, setProximaRevisao] = useState(pop?.proxima_revisao ?? '')

  const [objetivo, setObjetivo] = useState(pop?.objetivo ?? '')

  const [aplicacao, setAplicacao] = useState(pop?.aplicacao ?? '')
  const [setoresAplicaveis, setSetoresAplicaveis] = useState<string[]>(pop?.setores_aplicaveis ?? [])
  const [aplicaATodos, setAplicaATodos] = useState(pop?.aplica_a_todos ?? false)

  const [responsabilidades, setResponsabilidades] = useState<PopResponsabilidade[]>(pop?.responsabilidades ?? [])
  const [materiais, setMateriais] = useState<PopMaterial[]>(pop?.materiais ?? [])
  const [etapas, setEtapas] = useState<PopEtapa[]>(pop?.etapas ?? [])

  const [seguranca, setSeguranca] = useState(pop?.seguranca ?? '')
  const [alertaImportante, setAlertaImportante] = useState(pop?.alerta_importante ?? '')

  const [frequencia, setFrequencia] = useState(pop?.frequencia ?? '')
  const [situacoesEspecificas, setSituacoesEspecificas] = useState(pop?.situacoes_especificas ?? '')

  const [monitoramento, setMonitoramento] = useState(pop?.monitoramento ?? '')
  const [responsavelMonitoramento, setResponsavelMonitoramento] = useState(pop?.responsavel_monitoramento ?? '')
  const [checklistVinculadoId, setChecklistVinculadoId] = useState(pop?.checklist_vinculado_id?.toString() ?? '')
  const [localRegistro, setLocalRegistro] = useState(pop?.local_registro ?? '')

  const [acoesCorretivas, setAcoesCorretivas] = useState<PopAcaoCorretiva[]>(pop?.acoes_corretivas ?? [])

  const [referencias, setReferencias] = useState(pop?.referencias ?? '')
  const [anexos, setAnexos] = useState<PopAnexo[]>(pop?.anexos ?? [])
  const [uploadingAnexo, setUploadingAnexo] = useState(false)
  const [vinculos, setVinculos] = useState<PopVinculo[]>(pop?.vinculos ?? [])
  const [vinculoTipo, setVinculoTipo] = useState<PopVinculoTipo | ''>('')
  const [vinculoId, setVinculoId] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<'rascunho' | 'publicada' | null>(null)

  const { data: categories } = usePopCategories()
  const { data: taxonomias } = useTaxonomias('pop')
  const subcategoriaOptions = useMemo(() => taxonomiaValores(taxonomias ?? [], setor, 'subcategoria'), [taxonomias, setor])
  const vinculoOptions = usePopVinculoOptions(vinculoTipo || null, setor, pop?.id)

  const { data: tarefasDoSetor } = useQuery({
    queryKey: ['checklist_tasks_para_pop', setor],
    queryFn: async () => {
      const query = supabase.from('checklist_tasks').select('id, title')
      const { data, error: qError } = setor === 'Geral' ? await query : await query.eq('setor', setor)
      if (qError) throw qError
      return data as { id: number; title: string }[]
    },
  })

  const isValid = !!titulo.trim() && !!setor

  function adicionarVinculo() {
    if (!vinculoTipo || !vinculoId) return
    if (vinculos.some((v) => v.tipo === vinculoTipo && v.id === vinculoId)) return
    setVinculos((prev) => [...prev, { tipo: vinculoTipo, id: vinculoId }])
    setVinculoId('')
  }

  async function handleAnexoSelected(file: File | undefined) {
    if (!file) return
    setUploadingAnexo(true)
    try {
      const url = await uploadPopAnexo(setor, pop?.id ?? 'novo', file)
      setAnexos((prev) => [...prev, { nome: file.name, url }])
    } finally {
      setUploadingAnexo(false)
    }
  }

  async function handleSave(target: 'rascunho' | 'publicada', e: FormEvent) {
    e.preventDefault()
    if (!isValid) return
    setError(null)
    setSubmitting(target)
    try {
      const now = isoDate(new Date())
      const historicoTipo = !pop ? ('criacao' as const) : ('revisao' as const)
      const autor = profile?.nome ?? 'Desconhecido'
      const historicoBase = pop?.historico ?? []
      const historico =
        target === 'publicada'
          ? [...historicoBase, { data: new Date().toISOString(), tipo: historicoTipo, autor }, { data: new Date().toISOString(), tipo: 'publicacao' as const, autor }]
          : [...historicoBase, { data: new Date().toISOString(), tipo: historicoTipo, autor }]

      const payload = {
        titulo: titulo.trim(),
        codigo: codigo.trim() || null,
        setor,
        category_id: categoryId || null,
        subcategoria: subcategoria.trim() || null,
        estabelecimento: estabelecimento.trim() || 'Abrazo Drink Bar',
        elaborado_por: elaboradoPor.trim() || null,
        aprovado_por: aprovadoPor.trim() || null,
        data_emissao: dataEmissao,
        ultima_revisao_em: now,
        proxima_revisao: proximaRevisao.trim() || null,
        status: target,
        objetivo: objetivo.trim(),
        aplicacao: aplicacao.trim(),
        setores_aplicaveis: setoresAplicaveis,
        aplica_a_todos: aplicaATodos,
        responsabilidades,
        materiais,
        etapas,
        seguranca: seguranca.trim(),
        alerta_importante: alertaImportante.trim() || null,
        frequencia: frequencia.trim(),
        situacoes_especificas: situacoesEspecificas.trim() || null,
        monitoramento: monitoramento.trim(),
        responsavel_monitoramento: responsavelMonitoramento.trim() || null,
        checklist_vinculado_id: checklistVinculadoId ? Number(checklistVinculadoId) : null,
        local_registro: localRegistro.trim() || null,
        acoes_corretivas: acoesCorretivas,
        referencias: referencias.trim() || null,
        anexos,
        vinculos,
        historico,
        ...(target === 'publicada' ? { publicado_por: profile?.nome ?? null, publicado_em: new Date().toISOString() } : {}),
      }

      await registrarTaxonomia('pop', setor, '', subcategoria)

      if (pop) {
        const { error: updateError } = await supabase
          .from('pops')
          .update({ ...payload, versao: pop.versao + 1 })
          .eq('id', pop.id)
        if (updateError) {
          setError(updateError.message)
          return
        }
      } else {
        const { error: insertError } = await supabase.from('pops').insert(payload)
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
          <h3>{isEdit ? 'Editar POP' : 'Novo POP'}</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <form className="modal-body" onSubmit={(e) => handleSave('rascunho', e)}>
          <h4 className="section-label">1. Identificação do documento</h4>
          <div className="field-row">
            <div className="field">
              <label>Título *</label>
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
            </div>
            <div className="field">
              <label>Código</label>
              <input value={codigo} onChange={(e) => setCodigo(e.target.value)} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Setor *</label>
              <select
                value={setor}
                onChange={(e) => {
                  setSetor(e.target.value as PopSetor)
                  setVinculoId('')
                }}
                disabled={!!lockedSetor}
              >
                {POP_SETORES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Categoria</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Selecione...</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Subcategoria</label>
              <input value={subcategoria} onChange={(e) => setSubcategoria(e.target.value)} list="pop-subcategoria-list" />
              <datalist id="pop-subcategoria-list">
                {subcategoriaOptions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Estabelecimento</label>
              <input value={estabelecimento} onChange={(e) => setEstabelecimento(e.target.value)} />
            </div>
            <div className="field">
              <label>Elaborado por</label>
              <input value={elaboradoPor} onChange={(e) => setElaboradoPor(e.target.value)} />
            </div>
            <div className="field">
              <label>Aprovado por</label>
              <input value={aprovadoPor} onChange={(e) => setAprovadoPor(e.target.value)} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Data de emissão</label>
              <input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} />
            </div>
            <div className="field">
              <label>Próxima revisão</label>
              <input value={proximaRevisao} onChange={(e) => setProximaRevisao(e.target.value)} placeholder="ex.: 12 meses" />
            </div>
            {isEdit && (
              <div className="field">
                <label>Versão atual</label>
                <p style={{ margin: 0 }}>{pop.versao}</p>
              </div>
            )}
          </div>

          <h4 className="section-label">2. Objetivo</h4>
          <div className="field">
            <textarea rows={2} value={objetivo} onChange={(e) => setObjetivo(e.target.value)} />
          </div>

          <h4 className="section-label">3. Aplicação e abrangência</h4>
          <div className="field">
            <label>Aplicação</label>
            <textarea rows={2} value={aplicacao} onChange={(e) => setAplicacao(e.target.value)} />
          </div>
          {setor === 'Geral' && (
            <div className="field">
              <label className="checkbox-field">
                <input type="checkbox" checked={aplicaATodos} onChange={(e) => setAplicaATodos(e.target.checked)} />
                Aplica-se a todos os setores
              </label>
              {!aplicaATodos && (
                <div className="sector-filter" style={{ marginTop: 8 }}>
                  {(['Bar', 'Cozinha', 'Salão'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`sector-filter-btn ${setoresAplicaveis.includes(s) ? 'active' : ''}`}
                      onClick={() =>
                        setSetoresAplicaveis((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
                      }
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <h4 className="section-label">4. Responsabilidades</h4>
          <div className="manage-list">
            {responsabilidades.map((r, i) => (
              <div className="manage-row" key={i}>
                <div className="manage-row-info" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                  <input
                    placeholder="Cargo"
                    value={r.cargo}
                    onChange={(e) => setResponsabilidades((prev) => prev.map((x, idx) => (idx === i ? { ...x, cargo: e.target.value } : x)))}
                  />
                  <input
                    placeholder="Responsabilidade"
                    value={r.responsabilidade}
                    onChange={(e) =>
                      setResponsabilidades((prev) => prev.map((x, idx) => (idx === i ? { ...x, responsabilidade: e.target.value } : x)))
                    }
                  />
                </div>
                <div className="manage-row-actions">
                  <button type="button" className="icon-btn danger" onClick={() => setResponsabilidades((prev) => prev.filter((_, idx) => idx !== i))}>
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => setResponsabilidades((prev) => [...prev, { cargo: '', responsabilidade: '' }])}>
            + Adicionar responsabilidade
          </button>

          <h4 className="section-label">5. Materiais, insumos e equipamentos</h4>
          <div className="manage-list">
            {materiais.map((m, i) => (
              <div className="manage-row" key={i}>
                <div className="manage-row-info">
                  <input
                    placeholder="Descrição"
                    value={m.descricao}
                    onChange={(e) => setMateriais((prev) => prev.map((x, idx) => (idx === i ? { descricao: e.target.value } : x)))}
                  />
                </div>
                <div className="manage-row-actions">
                  <button type="button" className="icon-btn danger" onClick={() => setMateriais((prev) => prev.filter((_, idx) => idx !== i))}>
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => setMateriais((prev) => [...prev, { descricao: '' }])}>
            + Adicionar material
          </button>

          <h4 className="section-label">6. Descrição do procedimento</h4>
          <div className="manage-list">
            {etapas.map((et, i) => (
              <div className="manage-row" key={i}>
                <div className="manage-row-info">
                  <input
                    placeholder="Título da etapa"
                    value={et.titulo}
                    onChange={(e) => setEtapas((prev) => prev.map((x, idx) => (idx === i ? { ...x, titulo: e.target.value } : x)))}
                  />
                  <textarea
                    placeholder="Descrição"
                    rows={2}
                    value={et.descricao}
                    onChange={(e) => setEtapas((prev) => prev.map((x, idx) => (idx === i ? { ...x, descricao: e.target.value } : x)))}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                    <input
                      placeholder="Tempo"
                      value={et.tempo ?? ''}
                      onChange={(e) => setEtapas((prev) => prev.map((x, idx) => (idx === i ? { ...x, tempo: e.target.value || null } : x)))}
                    />
                    <input
                      placeholder="Temperatura"
                      value={et.temperatura ?? ''}
                      onChange={(e) => setEtapas((prev) => prev.map((x, idx) => (idx === i ? { ...x, temperatura: e.target.value || null } : x)))}
                    />
                    <input
                      placeholder="Frequência"
                      value={et.frequencia ?? ''}
                      onChange={(e) => setEtapas((prev) => prev.map((x, idx) => (idx === i ? { ...x, frequencia: e.target.value || null } : x)))}
                    />
                    <input
                      placeholder="Observação"
                      value={et.observacao ?? ''}
                      onChange={(e) => setEtapas((prev) => prev.map((x, idx) => (idx === i ? { ...x, observacao: e.target.value || null } : x)))}
                    />
                  </div>
                </div>
                <div className="manage-row-actions">
                  <button type="button" className="icon-btn danger" onClick={() => setEtapas((prev) => prev.filter((_, idx) => idx !== i))}>
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => setEtapas((prev) => [...prev, novaEtapa()])}>
            + Adicionar etapa
          </button>

          <h4 className="section-label">7. Cuidados, segurança e alertas</h4>
          <div className="field-row">
            <div className="field">
              <label>Cuidados e segurança</label>
              <textarea rows={2} value={seguranca} onChange={(e) => setSeguranca(e.target.value)} />
            </div>
            <div className="field">
              <label>Alerta importante</label>
              <textarea rows={2} value={alertaImportante} onChange={(e) => setAlertaImportante(e.target.value)} />
            </div>
          </div>

          <h4 className="section-label">8. Frequência</h4>
          <div className="field-row">
            <div className="field">
              <label>Frequência</label>
              <input value={frequencia} onChange={(e) => setFrequencia(e.target.value)} />
            </div>
            <div className="field">
              <label>Situações específicas</label>
              <input value={situacoesEspecificas} onChange={(e) => setSituacoesEspecificas(e.target.value)} />
            </div>
          </div>

          <h4 className="section-label">9. Monitoramento e registros</h4>
          <div className="field">
            <label>Monitoramento</label>
            <textarea rows={2} value={monitoramento} onChange={(e) => setMonitoramento(e.target.value)} />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Responsável pelo monitoramento</label>
              <input value={responsavelMonitoramento} onChange={(e) => setResponsavelMonitoramento(e.target.value)} />
            </div>
            <div className="field">
              <label>Tarefa do Checklist vinculada</label>
              <select value={checklistVinculadoId} onChange={(e) => setChecklistVinculadoId(e.target.value)}>
                <option value="">Nenhuma</option>
                {tarefasDoSetor?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Local de registro</label>
              <input value={localRegistro} onChange={(e) => setLocalRegistro(e.target.value)} />
            </div>
          </div>

          <h4 className="section-label">10. Ações corretivas</h4>
          <div className="manage-list">
            {acoesCorretivas.map((a, i) => (
              <div className="manage-row" key={i}>
                <div className="manage-row-info">
                  <input
                    placeholder="Descrição"
                    value={a.descricao}
                    onChange={(e) => setAcoesCorretivas((prev) => prev.map((x, idx) => (idx === i ? { descricao: e.target.value } : x)))}
                  />
                </div>
                <div className="manage-row-actions">
                  <button type="button" className="icon-btn danger" onClick={() => setAcoesCorretivas((prev) => prev.filter((_, idx) => idx !== i))}>
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => setAcoesCorretivas((prev) => [...prev, { descricao: '' }])}>
            + Adicionar ação corretiva
          </button>

          <h4 className="section-label">11. Referências e anexos</h4>
          <div className="field">
            <label>Referências</label>
            <textarea rows={2} value={referencias} onChange={(e) => setReferencias(e.target.value)} />
          </div>
          <div className="field">
            <label>Anexos</label>
            <div className="manage-list">
              {anexos.map((a, i) => (
                <div className="manage-row" key={i}>
                  <div className="manage-row-info">
                    <input
                      value={a.nome}
                      onChange={(e) => setAnexos((prev) => prev.map((x, idx) => (idx === i ? { ...x, nome: e.target.value } : x)))}
                    />
                  </div>
                  <div className="manage-row-actions">
                    <button type="button" className="icon-btn danger" onClick={() => setAnexos((prev) => prev.filter((_, idx) => idx !== i))}>
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <input type="file" onChange={(e) => handleAnexoSelected(e.target.files?.[0])} disabled={uploadingAnexo} />
            {uploadingAnexo && <span className="field-hint">Enviando...</span>}
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
                  setVinculoTipo(e.target.value as PopVinculoTipo | '')
                  setVinculoId('')
                }}
              >
                <option value="">Selecione o tipo...</option>
                {POP_VINCULO_TIPOS.map((t) => (
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

          {isEdit && pop.historico.length > 0 && (
            <>
              <h4 className="section-label">12. Aprovação e histórico</h4>
              <div className="manage-list">
                {[...pop.historico].reverse().map((h, i) => (
                  <div className="manage-row" key={i}>
                    <div className="manage-row-info">
                      <span>
                        {h.tipo} · {h.autor} · {new Date(h.data).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {error && <p className="login-error">{error}</p>}

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-ghost" disabled={!isValid || !!submitting}>
              {submitting === 'rascunho' ? 'Salvando...' : 'Salvar rascunho'}
            </button>
            <button type="button" className="btn btn-primary" disabled={!isValid || !!submitting} onClick={(e) => handleSave('publicada', e as unknown as FormEvent)}>
              {submitting === 'publicada' ? 'Publicando...' : 'Publicar POP'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
