'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { CheckCircle, XCircle, AlertCircle, Loader2, Plus, Trash2, Send, ExternalLink } from 'lucide-react'

type WppStatus = 'CONECTADO' | 'DESCONECTADO' | 'ERRO'

type WppConfig = {
  alertas?:      { ativo?: boolean; numeros?: string[] }
  resumoDiario?: { ativo?: boolean; numeros?: string[] }
  ifood?:        { ativo?: boolean; threshold?: number; numeros?: string[] }
}

type IntegrationInfo = {
  status: WppStatus
  numeroConectado?: string
  ultimaConexao?: string
  config?: WppConfig
  instanceId?: string
}

type LogEntry = {
  id: string
  tipo: string
  destinatario: string
  status: string
  erro?: string | null
  createdAt: string
}

const TIPO_LABELS: Record<string, string> = { ALERTA: 'Alerta', RESUMO_DIARIO: 'Resumo Diário', PEDIDO_IFOOD: 'Pedido iFood' }
const TIPO_COLORS: Record<string, string> = { ALERTA: '#e05252', RESUMO_DIARIO: '#2a9d6f', PEDIDO_IFOOD: '#f97316' }

function StatusBadge({ status }: { status: WppStatus }) {
  const map = {
    CONECTADO:    { color: '#2a9d6f', bg: '#0d2b1f', label: 'Conectado',    icon: <CheckCircle size={13} /> },
    DESCONECTADO: { color: '#6b7280', bg: '#1a1a1a', label: 'Desconectado', icon: <XCircle size={13} /> },
    ERRO:         { color: '#e05252', bg: '#1f0a0a', label: 'Erro',          icon: <AlertCircle size={13} /> },
  }
  const c = map[status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, color: c.color, background: c.bg, border: `1px solid ${c.color}` }}>
      {c.icon} {c.label}
    </span>
  )
}

function NumberInput({ numbers, onChange }: { numbers: string[]; onChange: (nums: string[]) => void }) {
  const [input, setInput] = useState('')
  function add() {
    const n = input.trim().replace(/\s/g, '')
    if (n && !numbers.includes(n)) { onChange([...numbers, n]); setInput('') }
  }
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="+5511987654321"
          style={{ flex: 1, padding: '7px 10px', borderRadius: 7, border: '1px solid var(--tf-border)', background: 'var(--tf-surface2)', color: 'var(--tf-txt)', fontSize: 12 }}
        />
        <button onClick={add} style={{ padding: '7px 12px', borderRadius: 7, border: 'none', background: 'var(--tf-primary)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <Plus size={14} />
        </button>
      </div>
      {numbers.map((n) => (
        <div key={n} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 10px', borderRadius: 6, background: 'var(--tf-surface2)', marginBottom: 4, fontSize: 12, color: 'var(--tf-txt2)' }}>
          <span>{n}</span>
          <button onClick={() => onChange(numbers.filter((x) => x !== n))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tf-txt3)', display: 'flex' }}>
            <Trash2 size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
    >
      <div style={{ width: 36, height: 20, borderRadius: 10, background: checked ? 'var(--tf-primary)' : 'var(--tf-border)', position: 'relative', transition: 'background 200ms', flexShrink: 0 }}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: checked ? 18 : 2, transition: 'left 200ms' }} />
      </div>
      <span style={{ fontSize: 13, color: 'var(--tf-txt)', fontWeight: 500 }}>{label}</span>
    </button>
  )
}

export default function WhatsAppConfigPage() {
  const [instanceId, setInstanceId] = useState('')
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState<IntegrationInfo | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [polling, setPolling] = useState(false)
  const [config, setConfig] = useState<WppConfig>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const [testMsg, setTestMsg] = useState('')
  const [disconnectModal, setDisconnectModal] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logTipo, setLogTipo] = useState('')
  const [ifoodAtivo, setIfoodAtivo] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetch('/api/integracoes/ifood/connect')
      .then((r) => r.json())
      .then((d) => setIfoodAtivo(d.status === 'CONECTADO'))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/integracoes/whatsapp/connect')
      .then((r) => r.json())
      .then((d) => {
        if (d.status && d.status !== 'DESCONECTADO') {
          setInfo(d)
          setConfig(d.config ?? {})
        }
      })
      .catch(() => {})
  }, [])

  const loadLogs = useCallback(() => {
    const params = new URLSearchParams()
    if (logTipo) params.set('tipo', logTipo)
    fetch(`/api/integracoes/whatsapp/logs?${params}`)
      .then((r) => r.json())
      .then(setLogs)
      .catch(() => {})
  }, [logTipo])

  useEffect(() => {
    if (info?.status === 'CONECTADO') loadLogs()
  }, [info?.status, loadLogs])

  useEffect(() => {
    if (!polling) { if (pollingRef.current) clearInterval(pollingRef.current); return }
    pollingRef.current = setInterval(async () => {
      const r = await fetch('/api/integracoes/whatsapp/status').then((x) => x.json()).catch(() => null)
      if (!r) return
      setQrCode(r.qrCode ?? null)
      if (r.status === 'CONECTADO') {
        setPolling(false)
        const full = await fetch('/api/integracoes/whatsapp/connect').then((x) => x.json()).catch(() => null)
        if (full) { setInfo(full); setConfig(full.config ?? {}) }
      }
    }, 10_000)
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [polling])

  async function handleConnect() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/integracoes/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId, token }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Erro ao conectar') }
      setPolling(true)
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  async function handleSaveConfig() {
    setSaving(true); setSaved(false)
    try {
      await fetch('/api/integracoes/whatsapp/connect', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      })
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch { /* noop */ } finally { setSaving(false) }
  }

  async function handleTest() {
    setTestLoading(true); setTestMsg('')
    try {
      const res = await fetch('/api/integracoes/whatsapp/test', { method: 'POST' })
      const d = await res.json()
      setTestMsg(d.ok ? '✅ Mensagem enviada!' : `❌ ${d.error ?? 'Falha ao enviar'}`)
    } catch { setTestMsg('❌ Erro ao enviar') } finally { setTestLoading(false) }
  }

  async function handleDisconnect() {
    setLoading(true)
    try {
      await fetch('/api/integracoes/whatsapp/disconnect', { method: 'POST' })
      setInfo(null); setConfig({}); setQrCode(null); setPolling(false); setDisconnectModal(false)
    } catch { /* noop */ } finally { setLoading(false) }
  }

  function updateConfig(path: string[], value: unknown) {
    setConfig((prev) => {
      const next = structuredClone(prev) as Record<string, unknown>
      let cur = next
      for (let i = 0; i < path.length - 1; i++) {
        if (!cur[path[i]]) cur[path[i]] = {}
        cur = cur[path[i]] as Record<string, unknown>
      }
      cur[path[path.length - 1]] = value
      return next as WppConfig
    })
  }

  if (info?.status === 'CONECTADO') {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: 32 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tf-txt)', marginBottom: 4 }}>WhatsApp</h1>
        <p style={{ fontSize: 13, color: 'var(--tf-txt3)', marginBottom: 24 }}>Gerencie notificações e alertas via WhatsApp.</p>

        <div style={{ padding: '18px 22px', borderRadius: 12, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--tf-txt)' }}>Status</span>
            <StatusBadge status="CONECTADO" />
          </div>
          {[
            { label: 'Número conectado', value: info.numeroConectado ?? '—' },
            { label: 'Última conexão', value: info.ultimaConexao ? new Date(info.ultimaConexao).toLocaleString('pt-BR') : '—' },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderTop: '1px solid var(--tf-border)' }}>
              <span style={{ fontSize: 13, color: 'var(--tf-txt2)' }}>{label}</span>
              <span style={{ fontSize: 13, color: 'var(--tf-txt)', fontWeight: 500 }}>{value}</span>
            </div>
          ))}
        </div>

        <div style={{ padding: '18px 22px', borderRadius: 12, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)', marginBottom: 20 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--tf-txt)', marginBottom: 18 }}>Configurações de envio</p>

          <div style={{ marginBottom: 20 }}>
            <Toggle checked={config.alertas?.ativo ?? false} onChange={(v) => updateConfig(['alertas', 'ativo'], v)} label="Alertas críticos por WhatsApp" />
            {config.alertas?.ativo && (
              <div style={{ marginLeft: 46, marginTop: 10 }}>
                <p style={{ fontSize: 11, color: 'var(--tf-txt3)', marginBottom: 6 }}>Números de destino</p>
                <NumberInput numbers={config.alertas?.numeros ?? []} onChange={(nums) => updateConfig(['alertas', 'numeros'], nums)} />
              </div>
            )}
          </div>

          <div style={{ marginBottom: 20 }}>
            <Toggle checked={config.resumoDiario?.ativo ?? false} onChange={(v) => updateConfig(['resumoDiario', 'ativo'], v)} label="Resumo diário por WhatsApp (23h)" />
            {config.resumoDiario?.ativo && (
              <div style={{ marginLeft: 46, marginTop: 10 }}>
                <p style={{ fontSize: 11, color: 'var(--tf-txt3)', marginBottom: 6 }}>Números de destino</p>
                <NumberInput numbers={config.resumoDiario?.numeros ?? []} onChange={(nums) => updateConfig(['resumoDiario', 'numeros'], nums)} />
              </div>
            )}
          </div>

          {ifoodAtivo && (
            <div style={{ marginBottom: 8 }}>
              <Toggle checked={config.ifood?.ativo ?? false} onChange={(v) => updateConfig(['ifood', 'ativo'], v)} label="Notificações de pedido iFood" />
              {config.ifood?.ativo && (
                <div style={{ marginLeft: 46, marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--tf-txt3)', marginBottom: 5 }}>Valor mínimo (R$)</label>
                    <input type="number" min="0" value={config.ifood?.threshold ?? 0} onChange={(e) => updateConfig(['ifood', 'threshold'], Number(e.target.value))} style={{ width: 120, padding: '7px 10px', borderRadius: 7, border: '1px solid var(--tf-border)', background: 'var(--tf-surface2)', color: 'var(--tf-txt)', fontSize: 13 }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 11, color: 'var(--tf-txt3)', marginBottom: 6 }}>Números de destino</p>
                    <NumberInput numbers={config.ifood?.numeros ?? []} onChange={(nums) => updateConfig(['ifood', 'numeros'], nums)} />
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 20, alignItems: 'center' }}>
            <button onClick={handleSaveConfig} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--tf-primary)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Salvando...' : saved ? 'Salvo ✓' : 'Salvar configurações'}
            </button>
            <button onClick={handleTest} disabled={testLoading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid var(--tf-border)', background: 'transparent', color: 'var(--tf-txt2)', fontSize: 13, cursor: testLoading ? 'not-allowed' : 'pointer' }}>
              {testLoading ? <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Send size={13} />}
              Enviar teste
            </button>
            {testMsg && <span style={{ fontSize: 12, color: testMsg.startsWith('✅') ? '#2a9d6f' : '#e05252' }}>{testMsg}</span>}
          </div>
        </div>

        <div style={{ padding: '18px 22px', borderRadius: 12, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--tf-txt)' }}>Histórico de mensagens</p>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['', 'Todos'], ['ALERTA', 'Alertas'], ['RESUMO_DIARIO', 'Resumos'], ['PEDIDO_IFOOD', 'iFood']].map(([val, label]) => (
                <button key={val} onClick={() => { setLogTipo(val); setTimeout(loadLogs, 0) }} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${logTipo === val ? 'var(--tf-primary)' : 'var(--tf-border)'}`, background: logTipo === val ? 'var(--tf-primary-bg)' : 'transparent', color: logTipo === val ? 'var(--tf-primary)' : 'var(--tf-txt3)', fontSize: 11, cursor: 'pointer' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {logs.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--tf-txt3)' }}>Nenhuma mensagem enviada.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Data', 'Tipo', 'Destinatário', 'Status'].map((h) => <th key={h} style={{ padding: '6px 0', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--tf-txt3)', textTransform: 'uppercase' }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} style={{ borderTop: '1px solid var(--tf-border)' }}>
                    <td style={{ padding: '8px 0', fontSize: 11, color: 'var(--tf-txt3)' }}>{new Date(log.createdAt).toLocaleString('pt-BR')}</td>
                    <td style={{ padding: '8px 0' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: TIPO_COLORS[log.tipo] ?? '#888', background: (TIPO_COLORS[log.tipo] ?? '#888') + '22', padding: '2px 6px', borderRadius: 8 }}>
                        {TIPO_LABELS[log.tipo] ?? log.tipo}
                      </span>
                    </td>
                    <td style={{ padding: '8px 0', fontSize: 12, color: 'var(--tf-txt2)', fontFamily: 'monospace' }}>{log.destinatario}</td>
                    <td style={{ padding: '8px 0' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: log.status === 'ENVIADO' ? '#2a9d6f' : '#e05252' }}>{log.status}</span>
                      {log.erro && <span style={{ fontSize: 10, color: 'var(--tf-txt3)', display: 'block' }}>{log.erro}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <button onClick={() => setDisconnectModal(true)} style={{ fontSize: 13, color: 'var(--tf-red)', background: 'var(--tf-red-bg)', border: '1px solid var(--tf-red-bd)', borderRadius: 8, padding: '8px 18px', cursor: 'pointer' }}>
          Desconectar WhatsApp
        </button>

        {disconnectModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
            <div style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', borderRadius: 12, padding: 28, maxWidth: 380, width: '100%' }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--tf-txt)', marginBottom: 10 }}>Desconectar WhatsApp?</p>
              <p style={{ fontSize: 13, color: 'var(--tf-txt2)', marginBottom: 24 }}>As configurações de envio serão mantidas. Você pode reconectar a qualquer momento.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setDisconnectModal(false)} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid var(--tf-border)', background: 'transparent', color: 'var(--tf-txt2)', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={handleDisconnect} disabled={loading} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: 'var(--tf-red)', color: '#fff', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
                  {loading ? '...' : 'Desconectar'}
                </button>
              </div>
            </div>
          </div>
        )}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 32 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tf-txt)', marginBottom: 4 }}>Conectar WhatsApp</h1>
      <p style={{ fontSize: 13, color: 'var(--tf-txt3)', marginBottom: 24 }}>
        Use o gateway Z-API para enviar notificações via WhatsApp.{' '}
        <a href="https://portal.z-api.io" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--tf-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          Portal Z-API <ExternalLink size={12} />
        </a>
      </p>
      <div style={{ padding: '22px 24px', borderRadius: 12, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)' }}>
        {!polling ? (
          <>
            {([['Instance ID', instanceId, setInstanceId, 'text'], ['Token', token, setToken, 'password']] as const).map(([label, value, set, type]) => (
              <div key={label} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tf-txt2)', marginBottom: 5 }}>{label}</label>
                <input type={type} value={value} onChange={(e) => (set as (v: string) => void)(e.target.value)} placeholder={label === 'Instance ID' ? 'Ex: 3E9B0B5...' : 'Cole o token aqui'} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--tf-border)', background: 'var(--tf-surface2)', color: 'var(--tf-txt)', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            ))}
            {error && <p style={{ fontSize: 13, color: 'var(--tf-red)', marginBottom: 12 }}>{error}</p>}
            <button onClick={handleConnect} disabled={loading || !instanceId || !token} style={{ width: '100%', padding: '10px 0', borderRadius: 8, border: 'none', background: 'var(--tf-primary)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: (loading || !instanceId || !token) ? 'not-allowed' : 'pointer', opacity: (loading || !instanceId || !token) ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {loading && <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />}
              {loading ? 'Conectando...' : 'Conectar e gerar QR Code'}
            </button>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--tf-txt2)', marginBottom: 16 }}>Escaneie o QR Code com o WhatsApp do número que será usado.</p>
            {qrCode ? (
              <img src={qrCode} alt="QR Code WhatsApp" style={{ width: 220, height: 220, borderRadius: 8, border: '1px solid var(--tf-border)' }} />
            ) : (
              <div style={{ width: 220, height: 220, borderRadius: 8, border: '1px solid var(--tf-border)', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--tf-surface2)' }}>
                <Loader2 size={32} style={{ color: 'var(--tf-primary)', animation: 'spin 0.8s linear infinite' }} />
              </div>
            )}
            <p style={{ fontSize: 12, color: 'var(--tf-txt3)', marginTop: 14 }}>Aguardando scan... (verificando a cada 10s)</p>
            <button onClick={() => setPolling(false)} style={{ marginTop: 12, fontSize: 12, color: 'var(--tf-txt3)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              Cancelar
            </button>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
