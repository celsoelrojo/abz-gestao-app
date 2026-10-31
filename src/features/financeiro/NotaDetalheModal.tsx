import { formatBRL } from './contaHelpers'
import { useNotaFotoUrl } from './useNotaFiscal'
import type { ContaPagarRow } from '../../types/database'

// A nota que originou a conta: foto + itens lidos (histórico do que foi comprado).
export function NotaDetalheModal({ conta, onClose }: { conta: ContaPagarRow; onClose: () => void }) {
  const { data: url, isLoading, isError } = useNotaFotoUrl(conta.nota_foto_path)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{conta.descricao}</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          {(conta.numero_nota || conta.fornecedor_cnpj) && (
            <p className="field-hint">
              {conta.numero_nota ? `Nota nº ${conta.numero_nota}` : ''}
              {conta.numero_nota && conta.fornecedor_cnpj ? ' · ' : ''}
              {conta.fornecedor_cnpj ? `CNPJ ${conta.fornecedor_cnpj}` : ''}
            </p>
          )}
          {conta.chave_acesso && <p className="field-hint">Chave de acesso: {conta.chave_acesso}</p>}

          {conta.itens_nota && conta.itens_nota.length > 0 && (
            <div className="manage-list" style={{ margin: '12px 0' }}>
              {conta.itens_nota.map((i, idx) => (
                <div className="manage-row" key={idx}>
                  <div className="manage-row-info">
                    <strong>{i.descricao}</strong>
                    <span>
                      {i.quantidade} {i.unidade} × {formatBRL(i.valor_unitario)} = {formatBRL(i.valor_total)}
                      {i.estoque_item_id ? ' · ligado ao estoque' : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {conta.nota_foto_path && isLoading && <div className="empty-state">Carregando foto…</div>}
          {conta.nota_foto_path && isError && <div className="empty-state">Não foi possível carregar a foto.</div>}
          {url && <img src={url} alt="Foto da nota" style={{ maxWidth: '100%', borderRadius: 8, display: 'block', margin: '0 auto' }} />}
        </div>
      </div>
    </div>
  )
}
