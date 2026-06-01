'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, AlertCircle, ExternalLink, Loader2 } from 'lucide-react'

type Status = 'CONECTADO' | 'DESCONECTADO' | 'ERRO'

type IntegrationInfo = {
  status: Status
  merchantId?: string
  ultimaSincronizacao?: string
  pedidosHoje?: number
}

type Loja = { id: string; name: string; type?: string }

const STEPS = ['Portal iFood', 'Credenciais', 'Conectar', 'Selecionar Loja', 'Confirmação']

export default function IFoodConfigPage() {
  const [step, setStep] = useState(0)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [lojas, setLojas] = useState<Loja[]>([])
  const [selectedLoja, setSelectedLoja] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState<IntegrationInfo | null>(null)
  const [disconnectModal, setDisconnectModal] = useState(false)

  useEffect(() => {
    fetch('/api/integracoes/ifood/connect')
      .then((r) => r.json())
      .then((d) => { if (d.status === 'CONECTADO') setInfo(d) })
      .catch(() => {})
  }, [])

  async function handleConnect() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/integracoes/ifood/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, clientSecret }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Erro ao conectar') }
      const lojasRes = await fetch('/api/integracoes/ifood/lojas')
      const lojasData = await lojasRes.json()
      const lista: Loja[] = Array.isArray(lojasData) ? lojasData : (lojasData.merchants ?? [])
      setLojas(lista)
      setStep(3)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDisconnect() {
    setLoading(true)
    try {
      await fetch('/api/integracoes/ifood/disconnect', { method: 'POST' })
      setInfo(null); setDisconnectModal(false); setStep(0)
    } catch { /* noop */ } finally { setLoading(false) }
  }

  const statusBadge = (s: Status) => {
    const map = {
      CONECTADO:    { color: '#2a9d6f', bg: '#0d2b1f', label: 'Conectado',    icon: <CheckCircle size={14} /> },
      DESCONECTADO: { color: '#6b7280', bg: '#1a1a1a', label: 'Desconectado', icon: <XCircle size={14} /> },
      ERRO:         { color: '#e05252', bg: '#1f0a0a', label: 'Erro',          icon: <AlertCircle size={14} /> },
    }
    const c = map[s]
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, color: c.color, background: c.bg, border: `1px solid ${c.color}` }}>
        {c.icon} {c.label}
      </span>
    )
  }

  if (info?.status === 'CONECTADO') {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: 32 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tf-txt)', marginBottom: 4 }}>Integração iFood</h1>
        <p style={{ fontSize: 13, color: 'var(--tf-txt3)', marginBottom: 28 }}>Sua conta iFood está conectada ao The Finance.</p>
        <div style={{ padding: '20px 24px', borderRadius: 12, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--tf-txt)' }}>Status da integração</span>
            {statusBadge(info.status)}
          </div>
          {[
            { label: 'Merchant ID', value: info.merchantId ?? '—' },
            { label: 'Última sincronização', value: info.ultimaSincronizacao ? new Date(info.ultimaSincronizacao).toLocaleString('pt-BR') : 'Nunca' },
            { label: 'Pedidos hoje', value: String(info.pedidosHoje ?? 0) },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--tf-border)' }}>
              <span style={{ fontSize: 13, color: 'var(--tf-txt2)' }}>{label}</span>
              <span style={{ fontSize: 13, color: 'var(--tf-txt)', fontWeight: 500 }}>{value}</span>
            </div>
          ))}
        </div>
        <button onClick={() => setDisconnectModal(true)} style={{ fontSize: 13, color: 'var(--tf-red)', background: 'var(--tf-red-bg)', border: '1px solid var(--tf-red-bd)', borderRadius: 8, padding: '8px 18px', cursor: 'pointer' }}>
          Desconectar iFood
        </button>
        {disconnectModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
            <div style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', borderRadius: 12, padding: 28, maxWidth: 380, width: '100%' }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--tf-txt)', marginBottom: 10 }}>Desconectar iFood?</p>
              <p style={{ fontSize: 13, color: 'var(--tf-txt2)', marginBottom: 24 }}>Os pedidos já recebidos não serão afetados. Você poderá reconectar a qualquer momento.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setDisconnectModal(false)} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid var(--tf-border)', background: 'transparent', color: 'var(--tf-txt2)', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={handleDisconnect} disabled={loading} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: 'var(--tf-red)', color: '#fff', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
                  {loading ? 'Aguarde...' : 'Desconectar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: 32 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tf-txt)', marginBottom: 4 }}>Conectar ao iFood</h1>
      <p style={{ fontSize: 13, color: 'var(--tf-txt3)', marginBottom: 28 }}>Siga os passos para integrar seu cardápio e receber pedidos do iFood.</p>
      <div style={{ display: 'flex', gap: 0, marginBottom: 32 }}>
        {STEPS.map((label, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, background: i <= step ? 'var(--tf-primary)' : 'var(--tf-surface2)', color: i <= step ? '#fff' : 'var(--tf-txt3)', border: i === step ? '2px solid var(--tf-primary)' : '2px solid transparent' }}>
              {i < step ? '✓' : i + 1}
            </div>
            <span style={{ fontSize: 10, color: i === step ? 'var(--tf-primary)' : 'var(--tf-txt3)', marginTop: 4, textAlign: 'center' }}>{label}</span>
          </div>
        ))}
      </div>
      <div style={{ padding: 24, borderRadius: 12, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)' }}>
        {step === 0 && (
          <>
            <p style={{ fontSize: 14, color: 'var(--tf-txt)', fontWeight: 600, marginBottom: 8 }}>Passo 1: Acesse o Portal iFood Parceiros</p>
            <p style={{ fontSize: 13, color: 'var(--tf-txt2)', lineHeight: 1.7, marginBottom: 16 }}>Acesse o Portal iFood, faça login com sua conta de restaurante e crie um novo aplicativo para obter o <strong>Client ID</strong> e o <strong>Client Secret</strong>.</p>
            <a href="https://portal.ifood.com.br/apps" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--tf-primary)', fontWeight: 600 }}>
              Abrir Portal iFood <ExternalLink size={13} />
            </a>
            <div style={{ marginTop: 24 }}>
              <button onClick={() => setStep(1)} style={{ padding: '9px 24px', borderRadius: 8, border: 'none', background: 'var(--tf-primary)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Já tenho as credenciais →</button>
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <p style={{ fontSize: 14, color: 'var(--tf-txt)', fontWeight: 600, marginBottom: 16 }}>Passo 2: Informe as credenciais</p>
            {([['Client ID', clientId, setClientId, 'text'], ['Client Secret', clientSecret, setClientSecret, 'password']] as const).map(([label, value, set, type]) => (
              <div key={label} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tf-txt2)', marginBottom: 5 }}>{label}</label>
                <input type={type} value={value} onChange={(e) => (set as (v: string) => void)(e.target.value)} placeholder={`Cole o ${label} aqui`} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--tf-border)', background: 'var(--tf-surface2)', color: 'var(--tf-txt)', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setStep(0)} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid var(--tf-border)', background: 'transparent', color: 'var(--tf-txt2)', cursor: 'pointer' }}>Voltar</button>
              <button onClick={() => setStep(2)} disabled={!clientId || !clientSecret} style={{ padding: '9px 24px', borderRadius: 8, border: 'none', background: 'var(--tf-primary)', color: '#fff', fontWeight: 600, cursor: (!clientId || !clientSecret) ? 'not-allowed' : 'pointer', opacity: (!clientId || !clientSecret) ? 0.5 : 1 }}>Continuar →</button>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <p style={{ fontSize: 14, color: 'var(--tf-txt)', fontWeight: 600, marginBottom: 8 }}>Passo 3: Conectar ao iFood</p>
            <p style={{ fontSize: 13, color: 'var(--tf-txt2)', lineHeight: 1.7, marginBottom: 20 }}>Ao clicar em <strong>Conectar</strong>, o sistema irá autenticar com o iFood usando suas credenciais.</p>
            {error && <p style={{ fontSize: 13, color: 'var(--tf-red)', marginBottom: 14 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(1)} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid var(--tf-border)', background: 'transparent', color: 'var(--tf-txt2)', cursor: 'pointer' }}>Voltar</button>
              <button onClick={handleConnect} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 24px', borderRadius: 8, border: 'none', background: 'var(--tf-primary)', color: '#fff', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
                {loading && <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />}
                {loading ? 'Conectando...' : 'Conectar'}
              </button>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </>
        )}
        {step === 3 && (
          <>
            <p style={{ fontSize: 14, color: 'var(--tf-txt)', fontWeight: 600, marginBottom: 16 }}>Passo 4: Selecione a loja</p>
            {lojas.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--tf-txt3)' }}>Nenhuma loja encontrada nesta conta.</p>
            ) : (
              <select value={selectedLoja} onChange={(e) => setSelectedLoja(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--tf-border)', background: 'var(--tf-surface2)', color: 'var(--tf-txt)', fontSize: 13 }}>
                <option value="">Selecione uma loja...</option>
                {lojas.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setStep(4)} disabled={!selectedLoja} style={{ padding: '9px 24px', borderRadius: 8, border: 'none', background: 'var(--tf-primary)', color: '#fff', fontWeight: 600, cursor: !selectedLoja ? 'not-allowed' : 'pointer', opacity: !selectedLoja ? 0.5 : 1 }}>Confirmar →</button>
            </div>
          </>
        )}
        {step === 4 && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <CheckCircle size={48} style={{ color: '#2a9d6f', marginBottom: 12 }} />
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--tf-txt)', marginBottom: 6 }}>iFood conectado com sucesso!</p>
            <p style={{ fontSize: 13, color: 'var(--tf-txt2)', lineHeight: 1.7 }}>Os pedidos chegam automaticamente no KDS da cozinha.</p>
            <a href="/configuracoes/integracoes/ifood/cardapio" style={{ display: 'inline-block', marginTop: 20, padding: '9px 24px', borderRadius: 8, background: 'var(--tf-primary)', color: '#fff', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>Mapear Cardápio →</a>
          </div>
        )}
      </div>
    </div>
  )
}
