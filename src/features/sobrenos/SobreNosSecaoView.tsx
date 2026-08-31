import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isFullAdmin, useAuthStore } from '../../store/authStore'
import { RichTextEditor } from '../../components/RichTextEditor'
import { isRichTextEmpty, sanitizeRichText } from '../../lib/richText'
import { SOBRE_NOS_KEY, atualizarSecaoSobreNos, useSobreNosSecoes } from './useSobreNos'
import type { SobreNosSecaoChave } from '../../types/database'

// Leitura liberada pra qualquer perfil logado (RLS sobre_nos_secoes_select_all);
// só o Administrador vê o botão "Editar" (RLS sobre_nos_secoes_update_admin
// bloquearia o UPDATE de qualquer outro perfil de qualquer forma — isso aqui
// só evita mostrar um botão que sempre falharia pra quem não é admin).
export function SobreNosSecaoView({ chave }: { chave: SobreNosSecaoChave }) {
  const profile = useAuthStore((s) => s.profile)
  const admin = isFullAdmin(profile)
  const queryClient = useQueryClient()
  const { data: secoes, isLoading } = useSobreNosSecoes()
  const secao = secoes?.find((s) => s.chave === chave)

  const [editando, setEditando] = useState(false)
  const [rascunho, setRascunho] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  if (isLoading) return <div className="empty-state">Carregando…</div>
  if (!secao) return <div className="empty-state">Seção não encontrada.</div>

  async function handleSalvar() {
    setError(null)
    setSalvando(true)
    try {
      await atualizarSecaoSobreNos(chave, rascunho)
      await queryClient.invalidateQueries({ queryKey: SOBRE_NOS_KEY })
      setEditando(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div>
      <div className="checklist-header" style={{ marginBottom: 16 }}>
        <h3 className="page-title" style={{ marginBottom: 0 }}>
          {secao.titulo}
        </h3>
        {admin && !editando && (
          <button
            className="btn btn-ghost"
            onClick={() => {
              // Começa o rascunho do conteúdo salvo agora, ao entrar em modo
              // de edição — evita carregar um rascunho velho se o admin
              // cancelar e clicar editar de novo.
              setRascunho(secao.conteudo_html)
              setEditando(true)
            }}
          >
            ✎ Editar
          </button>
        )}
      </div>

      {editando ? (
        <div>
          <RichTextEditor value={rascunho} onChange={setRascunho} />
          {error && <p className="login-error">{error}</p>}
          <div className="modal-footer" style={{ paddingLeft: 0, paddingRight: 0 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setEditando(false)} disabled={salvando}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSalvar} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      ) : !isRichTextEmpty(secao.conteudo_html) ? (
        // Sanitiza de novo no ponto de leitura (ver lib/richText) — mesmo já
        // sanitizado ao salvar, nunca confia em HTML vindo do banco sem
        // tratar de novo antes de um dangerouslySetInnerHTML.
        <div className="rich-text-body rich-text-readonly" dangerouslySetInnerHTML={{ __html: sanitizeRichText(secao.conteudo_html) }} />
      ) : (
        <div className="empty-state">
          {admin ? 'Nada escrito ainda — clique em "Editar" pra começar.' : 'Nada escrito aqui ainda.'}
        </div>
      )}
    </div>
  )
}
