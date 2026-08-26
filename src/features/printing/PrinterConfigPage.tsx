import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Capacitor } from '@capacitor/core'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'
import { enqueuePrintJob } from '../../lib/printing/printQueue'
import { toPrinterConfig } from '../../lib/printing/mappers'
import type { PrinterConfig } from '../../lib/printing/types'

// Exclusivo Administrador/Gestores (RLS: printers_manager_write, migration
// 0012). Impressão Bluetooth direta só liga quando: (1) o app está rodando
// empacotado via Capacitor (não no navegador) E (2) alguém já marcou
// protocolo_confirmado pra esse modelo — nunca assume que uma impressora
// Bluetooth qualquer fala TSPL.
export function PrinterConfigPage() {
  const profile = useAuthStore((s) => s.profile)
  const queryClient = useQueryClient()
  const isNative = Capacitor.isNativePlatform()

  const { data: printers, isLoading } = useQuery({
    queryKey: ['printers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('printers').select('*').order('nome')
      if (error) throw error
      return data.map(toPrinterConfig)
    },
  })

  const [form, setForm] = useState({
    nome: '',
    modelo: '',
    conexao: 'Bluetooth' as PrinterConfig['conexao'],
    linguagem: 'TSPL' as PrinterConfig['linguagem'],
    larguraMm: 50,
    alturaMm: 30,
    espacamentoMm: 2,
    densidade: 8,
    velocidade: 4,
  })
  const [testResult, setTestResult] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const { error } = await supabase.from('printers').insert({
        nome: form.nome,
        modelo: form.modelo,
        conexao: form.conexao,
        linguagem: form.linguagem,
        largura_mm: form.larguraMm,
        altura_mm: form.alturaMm,
        espacamento_mm: form.espacamentoMm,
        densidade: form.densidade,
        velocidade: form.velocidade,
        created_by: profile?.id,
      })
      if (!error) {
        setForm((f) => ({ ...f, nome: '', modelo: '' }))
        await queryClient.invalidateQueries({ queryKey: ['printers'] })
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleTestPrint(printer: PrinterConfig) {
    setTestResult(null)
    if (!isNative) {
      setTestResult('Impressão Bluetooth direta só funciona no app instalado (Android/iOS). No navegador, o job entra na fila e pode ser impresso pelo sistema operacional.')
    } else if (!printer.protocoloConfirmado) {
      setTestResult('Confirme o protocolo desta impressora (edite o registro e marque "Protocolo confirmado") antes de habilitar a impressão direta.')
    }
    if (!profile) return
    try {
      await enqueuePrintJob({
        printer,
        lote_id: null,
        quantidade_etiquetas: 1,
        data: {
          produto: 'Teste de impressão',
          preparo: new Date().toLocaleString('pt-BR'),
          validade: '—',
          armazenar: '—',
          responsavel: profile.nome,
          quantidade: '1 Unidade',
        },
        responsavel_id: profile.id,
        responsavel_nome: profile.nome,
      })
      setTestResult((prev) => prev ?? 'Job de teste adicionado à fila de impressão.')
    } catch (err) {
      setTestResult(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="container">
      <div className="checklist-header">
        <div>
          <h2 className="page-title">Configuração de Impressora</h2>
          <p className="page-subtitle">Etiquetas de produção — arquitetura por adaptadores (TSPL hoje, ZPL/outros depois)</p>
        </div>
      </div>

      <form className="modal-body" onSubmit={handleSave} style={{ marginBottom: 24 }}>
        <div className="field">
          <label>Nome da impressora *</label>
          <input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} required />
        </div>
        <div className="field">
          <label>Modelo *</label>
          <input value={form.modelo} onChange={(e) => setForm((f) => ({ ...f, modelo: e.target.value }))} required />
        </div>
        <div className="field">
          <label>Tipo de conexão</label>
          <select value={form.conexao} onChange={(e) => setForm((f) => ({ ...f, conexao: e.target.value as PrinterConfig['conexao'] }))}>
            <option value="Bluetooth">Bluetooth</option>
            <option value="USB">USB</option>
            <option value="Rede">Rede</option>
          </select>
        </div>
        <div className="field">
          <label>Linguagem de impressão</label>
          <select value={form.linguagem} onChange={(e) => setForm((f) => ({ ...f, linguagem: e.target.value as PrinterConfig['linguagem'] }))}>
            <option value="TSPL">TSPL</option>
            <option value="ZPL">ZPL</option>
            <option value="Outro">Outro</option>
          </select>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Largura da etiqueta (mm)</label>
            <input type="number" value={form.larguraMm} onChange={(e) => setForm((f) => ({ ...f, larguraMm: Number(e.target.value) }))} />
          </div>
          <div className="field">
            <label>Altura da etiqueta (mm)</label>
            <input type="number" value={form.alturaMm} onChange={(e) => setForm((f) => ({ ...f, alturaMm: Number(e.target.value) }))} />
          </div>
        </div>
        <div className="field">
          <label>Espaçamento entre etiquetas (mm)</label>
          <input type="number" value={form.espacamentoMm} onChange={(e) => setForm((f) => ({ ...f, espacamentoMm: Number(e.target.value) }))} />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Densidade</label>
            <input type="number" value={form.densidade} onChange={(e) => setForm((f) => ({ ...f, densidade: Number(e.target.value) }))} />
          </div>
          <div className="field">
            <label>Velocidade</label>
            <input type="number" value={form.velocidade} onChange={(e) => setForm((f) => ({ ...f, velocidade: Number(e.target.value) }))} />
          </div>
        </div>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar impressora'}
        </button>
      </form>

      {testResult && <div className="pop-alert-box">{testResult}</div>}

      <div className="manage-list">
        {isLoading && <div className="empty-state">Carregando…</div>}
        {printers?.map((p) => (
          <div className="manage-row" key={p.id}>
            <div className="manage-row-info">
              <strong>{p.nome}</strong>
              <span>
                {p.modelo} · {p.conexao} · {p.linguagem} · {p.larguraMm}×{p.alturaMm}mm
                {!p.protocoloConfirmado && ' · protocolo não confirmado'}
              </span>
            </div>
            <div className="manage-row-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => handleTestPrint(p)}>
                Testar impressão
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
