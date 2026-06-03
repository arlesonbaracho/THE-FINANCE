'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, XCircle, Plus, Trash2, Edit2, Send, Loader2 } from 'lucide-react'

type Contato = {
  id: string
  nome: string
  numero: string
  permiteComandos: boolean
  recebeAlertas: boolean
  recebeResumoDiario: boolean
}

type ContatoForm = {
  nome: string
  numero: string
  permiteComandos: boolean
  recebeAlertas: boolean
  recebeResumoDiario: boolean
}

type LogEntry = {
  id: string
  tipo: string
  destinatario: string
  status: string
  erro?: string | null
  createdAt: string
}

const TIPO_LABELS: Record<string, string> = {
  ALERTA_CRITICO: 'Alerta Crítico', ALERTA_ALTO: 'Alerta Alto', ESTOQUE_BAIXO: 'Estoque Baixo',
  RESUMO_DIARIO: 'Resumo Diário', LIMITE_IA: 'Limite IA',
  CONFIRMACAO_BOT: 'Bot Confirmação', RESPOSTA_BOT: 'Bot Resposta', TESTE: 'Teste',
}
const TIPO_COLORS: Record<string, string> = {
  ALERTA_CRITICO: '#e05252', ALERTA_ALTO: '#f97316', ESTOQUE_BAIXO: '#f59e0b',
  RESUMO_DIARIO: '#2a9d6f', LIMITE_IA: '#8b5cf6',
  CONFIRMACAO_BOT: '#0ea5e9', RESPOSTA_BOT: '#0ea5e9', TESTE: '#6b7280',
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
      <div style={{ width: 36, height: 20, borderRadius: 10, background: checked ? 'var(--tf-primary)' : 'var(--tf-border)', position: 'relative', transition: 'background 200ms' }}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: checked ? 18 : 2, transition: 'left 200ms' }} />
      </div>
    </button>
  )
}

const FORM_VAZIO: ContatoForm = { nome: '', numero: '', permiteComandos: false, recebeAlertas: true, recebeResumoDiario: false }

export default function WhatsAppPage() {
  const [conexaoOk, setConexaoOk] = useState<boolean | null>(null)
  const [contatos, setContatos] = useState<Contato[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [modal, setModal] = useState<{ open: boolean; editId?: string; form: ContatoForm }>({ open: false, form: FORM_VAZIO })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [testLoading, setTestLoading] = useState(false)
  const [testNumero, setTestNumero] = useState('')
  const [testMsg, setTestMsg] = useState('')
  const [logTipo, setLogTipo] = useState('')

  useEffect(() => {
    fetch('/api/integracoes/whatsapp/status')
      .then((r) => r.json())
      .then((d) => setConexaoOk(d.conectado === true))
      .catch(() => setConexaoOk(false))
  }, [])

  const loadContatos = useCallback(() => {
    fetch('/api/integracoes/whatsapp/contatos')
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setContatos(d))
      .catch(() => {})
  }, [])

  const loadLogs = useCallback(() => {
    const p = logTipo ? `?tipo=${logTipo}` : ''
    fetch(`/api/integracoes/whatsapp/logs${p}`)
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setLogs(d))
      .catch(() => {})
  }, [logTipo])

  useEffect(() => { loadContatos() }, [loadContatos])
  useEffect(() => { loadLogs() }, [loadLogs])

  function abrirModal(contato?: Contato) {
    setFormError('')
    setModal({
      open: true,
      editId: contato?.id,
      form: contato
        ? { nome: contato.nome, numero: contato.numero, permiteComandos: contato.permiteComandos, recebeAlertas: contato.recebeAlertas, recebeResumoDiario: contato.recebeResumoDiario }
        : FORM_VAZIO,
    })
  }

  async function salvarContato() {
    setSaving(true); setFormError('')
    try {
      const url = modal.editId ? `/api/integracoes/whatsapp/contatos/${modal.editId}` : '/api/integracoes/whatsapp/contatos'
      const method = modal.editId ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(modal.form) })
      const d = await res.json()
      if (!res.ok) { setFormError(d.error ?? 'Erro ao salvar'); return }
      setModal({ open: false, form: FORM_VAZIO })
      loadContatos()
    } catch { setFormError('Erro de rede') } finally { setSaving(false) }
  }

  async function deletarContato(id: string) {
    await fetch(`/api/integracoes/whatsapp/contatos/${id}`, { method: 'DELETE' })
    loadContatos()
  }

  async function enviarTeste() {
    setTestLoading(true); setTestMsg('')
    try {
      const body = testNumero ? { numero: testNumero } : {}
      const res = await fetch('/api/integracoes/whatsapp/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await res.json()
      setTestMsg(d.ok ? '✅ Enviado!' : `❌ ${d.error ?? 'Falha'}`)
    } catch { setTestMsg('❌ Erro') } finally { setTestLoading(false) }
  }

  function updateForm(key: keyof ContatoForm, value: string | boolean) {
    setModal((prev) => ({ ...prev, form: { ...prev.form, [key]: value } }))
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 32 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tf-txt)', marginBottom: 4 }}>WhatsApp</h1>
      <p style={{ fontSize: 13, color: 'var(--tf-txt3)', marginBottom: 28 }}>Notificações via número único centralizado da plataforma.</p>

      {/* Bloco 1: Status do sistema */}
      <div style={{ padding: '16px 20px', borderRadius: 10, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tf-txt)', marginBottom: 2 }}>Status do sistema</p>
          <p style={{ fontSize: 12, color: 'var(--tf-txt3)' }}>Este número é compartilhado por todos os restaurantes na plataforma.</p>
        </div>
        {conexaoOk === null ? (
          <Loader2 size={18} style={{ color: 'var(--tf-txt3)', animation: 'spin 0.8s linear infinite' }} />
        ) : conexaoOk ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#2a9d6f', background: '#0d2b1f', border: '1px solid #2a9d6f' }}>
            <CheckCircle size={13} /> Conectado
          </span>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#e05252', background: '#1f0a0a', border: '1px solid #e05252' }}>
            <XCircle size={13} /> Desconectado
          </span>
        )}
      </div>

      {/* Bloco 2: Contatos */}
      <div style={{ padding: '18px 20px', borderRadius: 10, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--tf-txt)' }}>Contatos cadastrados</p>
          <button onClick={() => abrirModal()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: 'none', background: 'var(--tf-primary)', color: '#fff', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
            <Plus size={13} /> Adicionar contato
          </button>
        </div>
        {contatos.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--tf-txt3)' }}>Nenhum contato cadastrado.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Nome', 'Número', 'Comandos', 'Alertas', 'Resumo', 'Ações'].map((h) => (
                <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--tf-txt3)', textTransform: 'uppercase' }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {contatos.map((c) => (
                <tr key={c.id} style={{ borderTop: '1px solid var(--tf-border)' }}>
                  <td style={{ padding: '10px 8px', fontSize: 13, color: 'var(--tf-txt)', fontWeight: 500 }}>{c.nome}</td>
                  <td style={{ padding: '10px 8px', fontSize: 12, color: 'var(--tf-txt2)', fontFamily: 'monospace' }}>{c.numero}</td>
                  <td style={{ padding: '10px 8px' }}><span style={{ fontSize: 11, color: c.permiteComandos ? '#2a9d6f' : 'var(--tf-txt3)' }}>{c.permiteComandos ? '✓' : '—'}</span></td>
                  <td style={{ padding: '10px 8px' }}><span style={{ fontSize: 11, color: c.recebeAlertas ? '#2a9d6f' : 'var(--tf-txt3)' }}>{c.recebeAlertas ? '✓' : '—'}</span></td>
                  <td style={{ padding: '10px 8px' }}><span style={{ fontSize: 11, color: c.recebeResumoDiario ? '#2a9d6f' : 'var(--tf-txt3)' }}>{c.recebeResumoDiario ? '✓' : '—'}</span></td>
                  <td style={{ padding: '10px 8px', display: 'flex', gap: 6 }}>
                    <button onClick={() => abrirModal(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tf-txt3)', display: 'flex' }}><Edit2 size={14} /></button>
                    <button onClick={() => deletarContato(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tf-red)', display: 'flex' }}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Bloco 3: Histórico */}
      <div style={{ padding: '18px 20px', borderRadius: 10, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--tf-txt)' }}>Histórico de mensagens</p>
          <div style={{ display: 'flex', gap: 6 }}>
            {([['', 'Todos'], ['ALERTA_CRITICO', 'Alertas'], ['RESUMO_DIARIO', 'Resumos'], ['RESPOSTA_BOT', 'Bot']] as [string, string][]).map(([val, label]) => (
              <button key={val} onClick={() => setLogTipo(val)} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${logTipo === val ? 'var(--tf-primary)' : 'var(--tf-border)'}`, background: logTipo === val ? 'var(--tf-primary-bg)' : 'transparent', color: logTipo === val ? 'var(--tf-primary)' : 'var(--tf-txt3)', fontSize: 11, cursor: 'pointer' }}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {logs.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--tf-txt3)' }}>Nenhuma mensagem enviada.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Tipo', 'Número', 'Status', 'Data'].map((h) => <th key={h} style={{ padding: '6px 0', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--tf-txt3)', textTransform: 'uppercase' }}>{h}</th>)}</tr></thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} style={{ borderTop: '1px solid var(--tf-border)' }}>
                  <td style={{ padding: '8px 0' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: TIPO_COLORS[log.tipo] ?? '#888', background: (TIPO_COLORS[log.tipo] ?? '#888') + '22', padding: '2px 6px', borderRadius: 8 }}>
                      {TIPO_LABELS[log.tipo] ?? log.tipo}
                    </span>
                  </td>
                  <td style={{ padding: '8px 0', fontSize: 12, color: 'var(--tf-txt2)', fontFamily: 'monospace' }}>{log.destinatario}</td>
                  <td style={{ padding: '8px 0' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: log.status === 'ENVIADO' ? '#2a9d6f' : '#e05252' }}>{log.status}</span>
                  </td>
                  <td style={{ padding: '8px 0', fontSize: 11, color: 'var(--tf-txt3)' }}>{new Date(log.createdAt).toLocaleString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Bloco 4: Teste */}
      <div style={{ padding: '18px 20px', borderRadius: 10, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)' }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--tf-txt)', marginBottom: 14 }}>Mensagem de teste</p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={testNumero} onChange={(e) => setTestNumero(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--tf-border)', background: 'var(--tf-surface2)', color: 'var(--tf-txt)', fontSize: 13, minWidth: 200 }}>
            <option value="">Primeiro contato disponível</option>
            {contatos.map((c) => <option key={c.id} value={c.numero}>{c.nome} ({c.numero})</option>)}
          </select>
          <button onClick={enviarTeste} disabled={testLoading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid var(--tf-border)', background: 'transparent', color: 'var(--tf-txt2)', fontSize: 13, cursor: testLoading ? 'not-allowed' : 'pointer' }}>
            {testLoading ? <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Send size={13} />}
            Enviar teste
          </button>
          {testMsg && <span style={{ fontSize: 12, color: testMsg.startsWith('✅') ? '#2a9d6f' : '#e05252' }}>{testMsg}</span>}
        </div>
      </div>

      {/* Modal contato */}
      {modal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', borderRadius: 12, padding: 28, maxWidth: 420, width: '100%' }}>
            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--tf-txt)', marginBottom: 20 }}>
              {modal.editId ? 'Editar contato' : 'Adicionar contato'}
            </p>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tf-txt2)', marginBottom: 5 }}>Nome *</label>
              <input value={modal.form.nome} onChange={(e) => updateForm('nome', e.target.value)} placeholder="Ex: Gerente João" style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--tf-border)', background: 'var(--tf-surface2)', color: 'var(--tf-txt)', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            {!modal.editId && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tf-txt2)', marginBottom: 5 }}>Número (E.164) *</label>
                <input value={modal.form.numero} onChange={(e) => updateForm('numero', e.target.value)} placeholder="+5511999999999" style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--tf-border)', background: 'var(--tf-surface2)', color: 'var(--tf-txt)', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            )}
            {([
              ['permiteComandos', 'Permite enviar comandos ao bot'],
              ['recebeAlertas', 'Recebe alertas críticos'],
              ['recebeResumoDiario', 'Recebe resumo diário (23h)'],
            ] as [keyof ContatoForm, string][]).map(([key, label]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--tf-txt)' }}>{label}</span>
                <Toggle checked={modal.form[key] as boolean} onChange={(v) => updateForm(key, v)} />
              </div>
            ))}
            {formError && <p style={{ fontSize: 12, color: '#e05252', marginBottom: 10 }}>{formError}</p>}
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button onClick={() => setModal({ open: false, form: FORM_VAZIO })} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid var(--tf-border)', background: 'transparent', color: 'var(--tf-txt2)', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvarContato} disabled={saving || !modal.form.nome || (!modal.editId && !modal.form.numero)} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: 'var(--tf-primary)', color: '#fff', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
