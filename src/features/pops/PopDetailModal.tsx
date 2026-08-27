import { usePopCategories } from './usePops'
import type { PopRow } from '../../types/database'

export function PopDetailModal({ pop, onClose }: { pop: PopRow; onClose: () => void }) {
  const { data: categories } = usePopCategories()
  const categoriaNome = categories?.find((c) => c.id === pop.category_id)?.name ?? null

  return (
    <div className="modal-overlay">
      <div className="modal modal-wide">
        <div className="modal-header">
          <h3>{pop.titulo}</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="account-badges" style={{ marginBottom: 12 }}>
            <span className="badge-status badge-status-ativa">{pop.setor}</span>
            {categoriaNome && <span className="badge-status badge-status-pendente">{categoriaNome}</span>}
            {pop.subcategoria && <span className="badge-status badge-status-pendente">{pop.subcategoria}</span>}
            <span className="badge-status badge-status-pendente">versão {pop.versao}</span>
          </div>
          <p className="field-hint">
            {pop.codigo ? `Código: ${pop.codigo} · ` : ''}
            {pop.estabelecimento} · Emissão: {new Date(pop.data_emissao).toLocaleDateString('pt-BR')} · Última revisão:{' '}
            {new Date(pop.ultima_revisao_em).toLocaleDateString('pt-BR')}
            {pop.proxima_revisao ? ` · Próxima revisão: ${pop.proxima_revisao}` : ''}
          </p>

          {pop.objetivo && (
            <>
              <h4 className="section-label">Objetivo</h4>
              <p>{pop.objetivo}</p>
            </>
          )}

          {pop.aplicacao && (
            <>
              <h4 className="section-label">Aplicação e abrangência</h4>
              <p>{pop.aplicacao}</p>
              {pop.setor === 'Geral' && (
                <p className="field-hint">
                  {pop.aplica_a_todos ? 'Todos os setores' : pop.setores_aplicaveis.join(', ') || '—'}
                </p>
              )}
            </>
          )}

          {pop.responsabilidades.length > 0 && (
            <>
              <h4 className="section-label">Responsabilidades</h4>
              <div className="manage-list">
                {pop.responsabilidades.map((r, i) => (
                  <div className="manage-row" key={i}>
                    <div className="manage-row-info">
                      <strong>{r.cargo}</strong>
                      <span style={{ display: 'block' }}>{r.responsabilidade}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {pop.materiais.length > 0 && (
            <>
              <h4 className="section-label">Materiais, insumos e equipamentos</h4>
              <ul>
                {pop.materiais.map((m, i) => (
                  <li key={i}>{m.descricao}</li>
                ))}
              </ul>
            </>
          )}

          {pop.etapas.length > 0 && (
            <>
              <h4 className="section-label">Descrição do procedimento</h4>
              <div className="manage-list">
                {pop.etapas.map((et, i) => (
                  <div className="manage-row" key={i}>
                    <div className="manage-row-info">
                      <strong>
                        {i + 1}. {et.titulo || '(sem título)'}
                      </strong>
                      <span style={{ display: 'block' }}>{et.descricao}</span>
                      {(et.tempo || et.temperatura || et.frequencia || et.observacao) && (
                        <span style={{ display: 'block' }}>
                          {[et.tempo, et.temperatura, et.frequencia, et.observacao].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {(pop.seguranca || pop.alerta_importante) && (
            <>
              <h4 className="section-label">Cuidados, segurança e alertas</h4>
              {pop.seguranca && <p>{pop.seguranca}</p>}
              {pop.alerta_importante && <p className="pop-alert-box">{pop.alerta_importante}</p>}
            </>
          )}

          {(pop.frequencia || pop.situacoes_especificas) && (
            <>
              <h4 className="section-label">Frequência</h4>
              <p>
                {pop.frequencia}
                {pop.situacoes_especificas ? ` · ${pop.situacoes_especificas}` : ''}
              </p>
            </>
          )}

          {(pop.monitoramento || pop.responsavel_monitoramento || pop.local_registro) && (
            <>
              <h4 className="section-label">Monitoramento e registros</h4>
              <p>{pop.monitoramento}</p>
              <p className="field-hint">
                {pop.responsavel_monitoramento ? `Responsável: ${pop.responsavel_monitoramento} · ` : ''}
                {pop.local_registro ? `Local de registro: ${pop.local_registro}` : ''}
              </p>
            </>
          )}

          {pop.acoes_corretivas.length > 0 && (
            <>
              <h4 className="section-label">Ações corretivas</h4>
              <ul>
                {pop.acoes_corretivas.map((a, i) => (
                  <li key={i}>{a.descricao}</li>
                ))}
              </ul>
            </>
          )}

          {(pop.referencias || pop.anexos.length > 0) && (
            <>
              <h4 className="section-label">Referências e anexos</h4>
              {pop.referencias && <p>{pop.referencias}</p>}
              {pop.anexos.length > 0 && (
                <ul>
                  {pop.anexos.map((a, i) => (
                    <li key={i}>{a.nome}</li>
                  ))}
                </ul>
              )}
            </>
          )}

          {pop.vinculos.length > 0 && (
            <>
              <h4 className="section-label">Vínculos</h4>
              <div className="account-badges">
                {pop.vinculos.map((v, i) => (
                  <span className="badge-status badge-status-pendente" key={`${v.tipo}-${v.id}-${i}`}>
                    {v.tipo}
                  </span>
                ))}
              </div>
            </>
          )}

          <h4 className="section-label">Aprovação e histórico</h4>
          <p className="field-hint">
            {pop.elaborado_por ? `Elaborado por ${pop.elaborado_por}` : ''}
            {pop.aprovado_por ? ` · Aprovado por ${pop.aprovado_por}` : ''}
            {pop.publicado_por ? ` · Publicado por ${pop.publicado_por}` : ''}
          </p>
          {pop.historico.length > 0 && (
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
          )}

          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose}>
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
