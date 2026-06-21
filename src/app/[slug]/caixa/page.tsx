'use client'

import { useEffect, useState, useCallback } from 'react'
import { ShoppingCart, Delete, Clock, RefreshCw, ArrowLeft, CheckCircle } from 'lucide-react'
import { getSocket } from '@/lib/socket-client'

const C = {
  pageBg:      '#131009',
  surface:     '#1a1608',
  surface2:    '#130f07',
  border:      '#2e2410',
  borderLight: '#1e1808',
  txt:         '#f0ece8',
  txt2:        '#dcd4c8',
  muted:       '#604830',
  dim:         '#503a20',
  subtle:      '#7a6040',
  accent:      '#b48a2a',
  accentLight: '#d4a84b',
  accentBg:    '#2b1f0d',
  red:         '#e05252',
  green:       '#2a9d6f',
  amber:       '#d97706',
  purple:      '#6d4fc2',
}

type PinUser  = { id: string; name: string; avatarUrl: string | null }
type TenantInfo = { id: string; name: string }
type Step    = 'select' | 'pin' | 'dashboard'

type Mesa    = { id: string; numero: number; identificacao: string | null; cadeiras: number; status: string }
type PedidoItem = { id: string; quantidade: number; precoUnitario: number; observacao: string | null; product: { id: string; name: string } }
type Pagamento  = { id: string; formaPagamento: string; valor: number }
type Pedido  = { id: string; status: string; subtotal: number; taxaServico: number; total: number; criadoEm: string; itens: PedidoItem[]; pagamentos: Pagamento[]; garcom?: { name: string } | null }
type ConfigPdv = { formasPagamento: string[]; taxaServicoAtiva: boolean; taxaServico: number }

type DashView = 'mesas' | 'pedido' | 'finalizar'
type NfceStatus = { status: string | null; danfeUrl?: string | null; chaveAcesso?: string | null; motivoRejeicao?: string | null }

const FORMAS_LABEL: Record<string, string> = { DINHEIRO: 'Dinheiro', DEBITO: 'Débito', CREDITO: 'Crédito', PIX: 'Pix' }

function mesaStatusColor(s: string) {
  if (s === 'LIVRE') return C.green
  if (s === 'OCUPADA') return C.amber
  return C.purple
}

function formatPrice(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 1) return 'agora'
  if (diff < 60) return `${diff} min`
  return `${Math.floor(diff / 60)}h${diff % 60 > 0 ? ` ${diff % 60}min` : ''}`
}

export default function CaixaPage({ params }: { params: { slug: string } }) {
  const { slug } = params

  const [tenant, setTenant]         = useState<TenantInfo | null>(null)
  const [users, setUsers]           = useState<PinUser[]>([])
  const [loading, setLoading]       = useState(true)
  const [notFound, setNotFound]     = useState(false)
  const [step, setStep]             = useState<Step>('select')
  const [selected, setSelected]     = useState<PinUser | null>(null)
  const [loggedUser, setLoggedUser] = useState<PinUser | null>(null)
  const [pin, setPin]               = useState('')
  const [error, setError]           = useState('')
  const [authing, setAuthing]       = useState(false)
  const [now, setNow]               = useState(new Date())

  // Dashboard state
  const [dashView, setDashView]     = useState<DashView>('mesas')
  const [mesas, setMesas]           = useState<Mesa[]>([])
  const [mesaAtiva, setMesaAtiva]   = useState<Mesa | null>(null)
  const [pedido, setPedido]         = useState<Pedido | null>(null)
  const [config, setConfig]         = useState<ConfigPdv | null>(null)
  const [formaSelected, setFormaSelected] = useState<string>('')
  const [finalizing, setFinalizing] = useState(false)
  const [finalized, setFinalized]   = useState(false)
  const [loadingPedido, setLoadingPedido] = useState(false)
  const [pixModal, setPixModal] = useState<{ qrCode: string; qrCodeBase64: string; txId: string; expiresAt: string } | null>(null)
  const [pixLoading, setPixLoading] = useState(false)
  const [pixPolling, setPixPolling] = useState<ReturnType<typeof setInterval> | null>(null)

  // NFC-e state
  const [nfceStatus, setNfceStatus] = useState<NfceStatus | null>(null)
  const [emitingNfce, setEmitingNfce] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    return () => { if (pixPolling) clearInterval(pixPolling) }
  }, [pixPolling])

  const loadPage = useCallback(() => {
    setLoading(true)
    fetch(`/api/caixa/auth?slug=${slug}`)
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok || !d.tenant) { setNotFound(true); setLoading(false); return }
        setTenant(d.tenant)
        if (Array.isArray(d.users)) setUsers(d.users)
        setLoading(false)
      })
      .catch(() => { setNotFound(true); setLoading(false) })
  }, [slug])

  useEffect(() => { loadPage() }, [loadPage])

  const loadMesas = useCallback(async () => {
    const r = await fetch(`/api/mesas?slug=${slug}`)
    if (r.ok) setMesas(await r.json())
  }, [slug])

  const loadConfig = useCallback(async () => {
    const r = await fetch(`/api/config-pdv?slug=${slug}`)
    if (r.ok) setConfig(await r.json())
  }, [slug])

  useEffect(() => {
    if (step === 'dashboard') {
      loadMesas()
      loadConfig()
    }
  }, [step, loadMesas, loadConfig])

  // Join tenant room and listen for mesa:status updates
  useEffect(() => {
    if (step !== 'dashboard') return
    let socket: ReturnType<typeof getSocket> | null = null
    try {
      socket = getSocket()
      const handleMesaStatus = () => loadMesas()
      socket.on('mesa:status', handleMesaStatus)
      return () => { socket?.off('mesa:status', handleMesaStatus) }
    } catch { /* socket optional */ }
  }, [step, loadMesas])

  async function openMesa(mesa: Mesa) {
    if (mesa.status !== 'OCUPADA') return
    setMesaAtiva(mesa)
    setLoadingPedido(true)
    setDashView('pedido')
    setNfceStatus(null)
    const r = await fetch(`/api/pedidos?slug=${slug}&mesaId=${mesa.id}&status=ABERTO,EM_PREPARO,PRONTO,ENTREGUE`)
    if (r.ok) {
      const list: Pedido[] = await r.json()
      const p = list[0] ?? null
      setPedido(p)
      if (p) loadNfceStatus(p.id)
    }
    setLoadingPedido(false)
  }

  async function finalizarPedido() {
    if (!pedido || !formaSelected) return
    const pedidoId = pedido.id
    setFinalizing(true)
    const r = await fetch(`/api/pedidos/${pedidoId}/finalizar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formaPagamento: formaSelected, valor: pedido.total, slug }),
    })
    setFinalizing(false)
    if (!r.ok) return
    setFinalized(true)
    // Start NFC-e status polling after finalization
    pollNfceStatus(pedidoId)
    setTimeout(() => {
      setFinalized(false)
      setDashView('mesas')
      setMesaAtiva(null)
      setPedido(null)
      setFormaSelected('')
      setNfceStatus(null)
      loadMesas()
    }, 2000)
  }

  async function gerarPixPedido() {
    if (!pedido) return
    setPixLoading(true)
    try {
      const r = await fetch('/api/pagamentos/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedidoId: pedido.id, slug }),
      })
      if (!r.ok) { setPixLoading(false); return }
      const data = await r.json()
      setPixModal(data)
      setPixLoading(false)

      // Poll for payment status every 3 seconds
      const interval = setInterval(async () => {
        const statusR = await fetch(`/api/pagamentos/status/${data.txId}`)
        if (!statusR.ok) return
        const { status } = await statusR.json()
        if (status === 'approved') {
          clearInterval(interval)
          setPixPolling(null)
          setPixModal(null)
          await finalizarPedido()
        }
      }, 3000)
      setPixPolling(interval)
    } catch {
      setPixLoading(false)
    }
  }

  async function loadNfceStatus(pedidoId: string) {
    try {
      const r = await fetch(`/api/fiscal/nfce/status/${pedidoId}`)
      if (r.ok) setNfceStatus(await r.json())
    } catch { /* non-critical */ }
  }

  async function pollNfceStatus(pedidoId: string) {
    let tries = 0
    const iv = setInterval(async () => {
      tries++
      try {
        const r = await fetch(`/api/fiscal/nfce/status/${pedidoId}`)
        if (r.ok) {
          const data: NfceStatus = await r.json()
          setNfceStatus(data)
          if (data.status === 'AUTORIZADA' || data.status === 'REJEITADA' || tries >= 5) {
            clearInterval(iv)
          }
        } else {
          clearInterval(iv)
        }
      } catch { clearInterval(iv) }
    }, 3000)
  }

  async function emitirNfce(pedidoId: string) {
    setEmitingNfce(true)
    try {
      const r = await fetch('/api/fiscal/nfce/emitir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedidoId }),
      })
      if (r.ok) {
        setNfceStatus({ status: 'PROCESSANDO' })
        pollNfceStatus(pedidoId)
      }
    } finally {
      setEmitingNfce(false)
    }
  }

  function selectUser(user: PinUser) {
    setSelected(user)
    setPin('')
    setError('')
    setStep('pin')
  }

  function pressDigit(d: string) {
    if (pin.length < 4) setPin((p) => p + d)
  }

  function backspace() {
    setPin((p) => p.slice(0, -1))
  }

  useEffect(() => {
    if (pin.length === 4) authenticate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  async function authenticate() {
    if (!selected) return
    setAuthing(true)
    setError('')
    const res = await fetch('/api/caixa/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantSlug: slug, userId: selected.id, pin }),
    })
    const data = await res.json()
    setAuthing(false)
    if (!res.ok) {
      setError(data?.error ?? 'PIN incorreto')
      setPin('')
      return
    }
    setLoggedUser({ id: data.id, name: data.name, avatarUrl: data.avatarUrl })
    setStep('dashboard')
    setPin('')
  }

  function handleLogout() {
    setStep('select')
    setSelected(null)
    setLoggedUser(null)
    setPin('')
    setError('')
    setDashView('mesas')
    setMesaAtiva(null)
    setPedido(null)
  }

  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  if (notFound) return (
    <div style={{ minHeight: '100vh', background: C.pageBg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <ShoppingCart size={40} style={{ color: C.dim, marginBottom: 16 }} />
      <p style={{ fontSize: 16, fontWeight: 600, color: C.txt2, margin: 0 }}>Restaurante não encontrado</p>
      <p style={{ fontSize: 13, color: C.muted, margin: '8px 0 20px', textAlign: 'center' }}>
        O código &quot;{slug}&quot; não corresponde a nenhum restaurante cadastrado.
      </p>
      <a href="/auth/login" style={{ fontSize: 13, color: C.accentLight, textDecoration: 'none' }}>← Voltar ao login</a>
    </div>
  )

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.pageBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: `2px solid ${C.border}`, borderTopColor: C.accentLight, animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  // ── Dashboard ──────────────────────────────────────────────────────────────────

  if (step === 'dashboard') {
    return (
      <div style={{ minHeight: '100vh', background: C.pageBg, display: 'flex', flexDirection: 'column' }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

        {/* Topbar */}
        <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {dashView !== 'mesas' && (
              <button
                onClick={() => {
                  if (dashView === 'finalizar') { setDashView('pedido'); setFormaSelected('') }
                  else { setDashView('mesas'); setMesaAtiva(null); setPedido(null) }
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.txt2, display: 'flex', alignItems: 'center', gap: 4, marginRight: 4 }}
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <ShoppingCart size={18} style={{ color: C.accentLight }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: C.txt }}>{tenant?.name ?? slug}</span>
            <span style={{ fontSize: 12, color: C.muted }}>/ Caixa</span>
            {mesaAtiva && <span style={{ fontSize: 12, color: C.accentLight, background: C.accentBg, padding: '2px 8px', borderRadius: 4 }}>Mesa #{mesaAtiva.numero}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Clock size={12} style={{ color: C.subtle }} />
              <span style={{ fontSize: 12, color: C.subtle }}>{timeStr}</span>
            </div>
            {dashView === 'mesas' && (
              <button onClick={loadMesas} title="Atualizar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.dim }}>
                <RefreshCw size={14} />
              </button>
            )}
            <span style={{ fontSize: 13, color: C.txt2 }}>{loggedUser?.name}</span>
            <button onClick={handleLogout} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 10px', color: C.muted, fontSize: 12, cursor: 'pointer' }}>
              Sair
            </button>
          </div>
        </div>

        {/* Success overlay */}
        {finalized && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 100, gap: 12 }}>
            <CheckCircle size={64} style={{ color: C.green }} />
            <p style={{ color: C.txt, fontWeight: 600, fontSize: 18, margin: 0 }}>Pagamento confirmado!</p>
            <p style={{ color: C.txt2, fontSize: 14, margin: 0 }}>Mesa liberada.</p>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

          {/* ── Mesas ── */}
          {dashView === 'mesas' && (
            <>
              <p style={{ color: C.txt2, fontSize: 14, margin: '0 0 16px' }}>
                Clique em uma mesa <strong style={{ color: C.amber }}>OCUPADA</strong> para ver o pedido:
              </p>
              {mesas.length === 0 && <p style={{ color: C.muted, fontSize: 13 }}>Nenhuma mesa cadastrada.</p>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
                {mesas.map((m) => {
                  const color = mesaStatusColor(m.status)
                  const ocupada = m.status === 'OCUPADA'
                  return (
                    <button
                      key={m.id}
                      onClick={() => ocupada && openMesa(m)}
                      disabled={!ocupada}
                      style={{
                        padding: '14px 10px',
                        background: ocupada ? C.surface : C.surface2,
                        border: `2px solid ${ocupada ? color : C.border}`,
                        borderRadius: 10,
                        cursor: ocupada ? 'pointer' : 'default',
                        opacity: ocupada ? 1 : 0.5,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: 20, color: ocupada ? C.txt : C.txt2 }}>#{m.numero}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color, textTransform: 'uppercase' }}>{m.status}</span>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* ── Pedido ── */}
          {dashView === 'pedido' && (
            <div style={{ maxWidth: 500 }}>
              {loadingPedido ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${C.border}`, borderTopColor: C.accentLight, animation: 'spin 0.8s linear infinite' }} />
                </div>
              ) : !pedido ? (
                <p style={{ color: C.muted, fontSize: 13 }}>Nenhum pedido aberto para esta mesa.</p>
              ) : (
                <>
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: C.muted }}>Garçom: {pedido.garcom?.name ?? '—'}</span>
                      <span style={{ fontSize: 12, color: C.subtle }}>{timeAgo(pedido.criadoEm)}</span>
                    </div>
                    {pedido.itens.map((item) => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.borderLight}` }}>
                        <div>
                          <span style={{ fontSize: 14, color: C.txt }}>{item.quantidade}× {item.product.name}</span>
                          {item.observacao && <p style={{ margin: 0, fontSize: 12, color: C.muted, fontStyle: 'italic' }}>{item.observacao}</p>}
                        </div>
                        <span style={{ fontSize: 13, color: C.txt2 }}>{formatPrice(item.precoUnitario * item.quantidade)}</span>
                      </div>
                    ))}
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.txt2 }}>
                        <span>Subtotal</span><span>{formatPrice(pedido.subtotal)}</span>
                      </div>
                      {pedido.taxaServico > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.txt2 }}>
                          <span>Taxa de serviço</span><span>{formatPrice(pedido.taxaServico)}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, color: C.txt, marginTop: 4 }}>
                        <span>Total</span><span>{formatPrice(pedido.total)}</span>
                      </div>
                    </div>
                  </div>

                  {/* NFC-e status badge */}
                  {nfceStatus && (
                    <div style={{ marginBottom: 10, padding: '10px 14px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.muted }}>NFC-e</span>
                      {nfceStatus.status === 'PROCESSANDO' && (
                        <span style={{ fontSize: 12, color: C.amber, fontWeight: 500 }}>● Processando…</span>
                      )}
                      {nfceStatus.status === 'AUTORIZADA' && (
                        <>
                          <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>✓ Autorizada</span>
                          {nfceStatus.danfeUrl && (
                            <a href={nfceStatus.danfeUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: C.accentLight, textDecoration: 'underline' }}>
                              Ver DANFE
                            </a>
                          )}
                        </>
                      )}
                      {nfceStatus.status === 'REJEITADA' && (
                        <span style={{ fontSize: 12, color: C.red, fontWeight: 500 }}>✗ Rejeitada{nfceStatus.motivoRejeicao ? ` — ${nfceStatus.motivoRejeicao}` : ''}</span>
                      )}
                      {(nfceStatus.status === null || nfceStatus.status === 'REJEITADA') && (
                        <button
                          onClick={() => pedido && emitirNfce(pedido.id)}
                          disabled={emitingNfce}
                          style={{ marginLeft: 'auto', padding: '4px 12px', background: C.accentBg, border: `1px solid ${C.accent}`, borderRadius: 6, color: C.accentLight, fontSize: 12, fontWeight: 600, cursor: emitingNfce ? 'not-allowed' : 'pointer', opacity: emitingNfce ? 0.6 : 1 }}
                        >
                          {emitingNfce ? 'Emitindo…' : nfceStatus.status === 'REJEITADA' ? 'Reemitir NFC-e' : 'Emitir NFC-e'}
                        </button>
                      )}
                    </div>
                  )}
                  {!nfceStatus && pedido && (
                    <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => emitirNfce(pedido.id)}
                        disabled={emitingNfce}
                        style={{ padding: '4px 12px', background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, color: C.subtle, fontSize: 12, cursor: emitingNfce ? 'not-allowed' : 'pointer', opacity: emitingNfce ? 0.6 : 1 }}
                      >
                        {emitingNfce ? 'Emitindo…' : 'Emitir NFC-e'}
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => setDashView('finalizar')}
                    style={{ width: '100%', padding: '14px 0', background: C.accent, border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
                  >
                    Finalizar pagamento
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── Finalizar ── */}
          {dashView === 'finalizar' && pedido && (
            <div style={{ maxWidth: 400 }}>
              <h2 style={{ color: C.txt, fontWeight: 600, fontSize: 16, margin: '0 0 6px' }}>Mesa #{mesaAtiva?.numero}</h2>
              <p style={{ color: C.txt2, fontSize: 13, margin: '0 0 20px' }}>
                Total: <strong style={{ color: C.accentLight, fontSize: 18 }}>{formatPrice(pedido.total)}</strong>
              </p>
              <p style={{ color: C.txt2, fontSize: 13, margin: '0 0 10px' }}>Forma de pagamento:</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
                {(config?.formasPagamento ?? ['DINHEIRO', 'DEBITO', 'CREDITO', 'PIX']).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormaSelected(f)}
                    style={{
                      padding: '10px 18px',
                      borderRadius: 8,
                      border: `2px solid ${formaSelected === f ? C.accent : C.border}`,
                      background: formaSelected === f ? C.accentBg : C.surface,
                      color: formaSelected === f ? C.accentLight : C.txt2,
                      fontWeight: formaSelected === f ? 700 : 400,
                      fontSize: 14,
                      cursor: 'pointer',
                    }}
                  >
                    {FORMAS_LABEL[f] ?? f}
                  </button>
                ))}
              </div>
              {formaSelected !== 'PIX' && (
                <button
                  onClick={finalizarPedido}
                  disabled={!formaSelected || finalizing}
                  style={{
                    width: '100%', padding: '14px 0', background: formaSelected ? C.accent : C.dim,
                    border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 15,
                    cursor: formaSelected ? 'pointer' : 'not-allowed',
                  }}
                >
                  {finalizing ? 'Processando…' : 'Confirmar pagamento'}
                </button>
              )}
              {formaSelected === 'PIX' && (
                <button
                  onClick={gerarPixPedido}
                  disabled={pixLoading}
                  style={{
                    background: C.accent,
                    color: C.pageBg,
                    border: 'none',
                    borderRadius: 8,
                    padding: '12px 24px',
                    fontWeight: 700,
                    fontSize: 15,
                    cursor: 'pointer',
                    width: '100%',
                    marginTop: 8,
                    opacity: pixLoading ? 0.6 : 1,
                  }}
                >
                  {pixLoading ? 'Gerando QR Code...' : 'Gerar QR Code Pix'}
                </button>
              )}
            </div>
          )}
        </div>

        {pixModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 32, maxWidth: 400, width: '90%', textAlign: 'center' }}>
              <p style={{ color: C.txt, fontWeight: 700, fontSize: 18, marginBottom: 16 }}>Pix — Aguardando pagamento</p>
              {pixModal.qrCodeBase64 ? (
                <img src={`data:image/png;base64,${pixModal.qrCodeBase64}`} alt="QR Code Pix" style={{ width: 200, height: 200, margin: '0 auto 16px' }} />
              ) : null}
              <p style={{ color: C.txt2, fontSize: 12, wordBreak: 'break-all', marginBottom: 16, padding: '8px 12px', background: C.surface2, borderRadius: 8 }}>
                {pixModal.qrCode}
              </p>
              <button
                onClick={() => navigator.clipboard.writeText(pixModal.qrCode)}
                style={{ background: C.accentBg, color: C.accentLight, border: `1px solid ${C.accent}`, borderRadius: 8, padding: '8px 16px', cursor: 'pointer', marginBottom: 16 }}
              >
                Copiar código Pix
              </button>
              <p style={{ color: C.muted, fontSize: 12 }}>Verificando pagamento automaticamente...</p>
              <button
                onClick={() => { if (pixPolling) clearInterval(pixPolling); setPixPolling(null); setPixModal(null) }}
                style={{ marginTop: 16, color: C.subtle, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Select / PIN ─────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: C.pageBg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <div style={{ margin: '0 auto 12px', width: 56, height: 56, borderRadius: 16, background: C.accentBg, border: `1px solid ${C.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ShoppingCart size={26} style={{ color: C.accentLight }} />
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: C.txt, margin: 0 }}>{tenant?.name ?? slug}</h1>
        <p style={{ fontSize: 13, color: C.muted, margin: '4px 0 0' }}>Painel do Caixa</p>
      </div>

      {step === 'select' && (
        <div style={{ width: '100%', maxWidth: 340 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 14 }}>
            <p style={{ fontSize: 13, color: C.subtle, margin: 0 }}>Selecione seu nome</p>
            <button onClick={loadPage} title="Atualizar lista" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.dim, padding: 4, display: 'flex', alignItems: 'center' }}>
              <RefreshCw size={13} />
            </button>
          </div>
          {users.length === 0 ? (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '32px 24px', textAlign: 'center' }}>
              <ShoppingCart size={32} style={{ color: C.dim, marginBottom: 10 }} />
              <p style={{ fontSize: 13, color: C.dim, margin: 0 }}>Nenhum caixa com PIN configurado</p>
              <p style={{ fontSize: 12, color: C.muted, margin: '6px 0 0' }}>Um administrador deve cadastrar caixas com PIN</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => selectUser(u)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, cursor: 'pointer', textAlign: 'left', width: '100%' }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.accentBg, border: `1px solid ${C.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.accentLight }}>{(u.name ?? '?')[0].toUpperCase()}</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 500, color: C.txt2 }}>{u.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 'pin' && (
        <div style={{ width: '100%', maxWidth: 280 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ margin: '0 auto 10px', width: 48, height: 48, borderRadius: '50%', background: C.accentBg, border: `2px solid ${C.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: C.accentLight }}>{(selected?.name ?? '?')[0].toUpperCase()}</span>
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: C.txt, margin: 0 }}>{selected?.name}</p>
            <p style={{ fontSize: 12, color: C.muted, margin: '2px 0 0' }}>Digite seu PIN</p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 20 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ width: 14, height: 14, borderRadius: '50%', background: i < pin.length ? C.accentLight : C.surface2, border: `2px solid ${i < pin.length ? C.accent : C.border}`, transition: 'background 0.12s' }} />
            ))}
          </div>
          {error && <p style={{ fontSize: 13, color: C.red, textAlign: 'center', marginBottom: 14 }}>{error}</p>}
          {authing && <p style={{ fontSize: 13, color: C.subtle, textAlign: 'center', marginBottom: 14 }}>Verificando...</p>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {['1','2','3','4','5','6','7','8','9'].map((d) => (
              <button key={d} onClick={() => pressDigit(d)} disabled={authing} style={{ height: 58, borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.txt, fontSize: 22, fontWeight: 600, cursor: 'pointer' }}>{d}</button>
            ))}
            <button onClick={() => { setStep('select'); setSelected(null); setPin(''); setError('') }} style={{ height: 58, borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.dim, fontSize: 11, cursor: 'pointer' }}>Voltar</button>
            <button onClick={() => pressDigit('0')} disabled={authing} style={{ height: 58, borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.txt, fontSize: 22, fontWeight: 600, cursor: 'pointer' }}>0</button>
            <button onClick={backspace} disabled={authing} style={{ height: 58, borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.subtle, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Delete size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
