'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { ShoppingCart, Delete, Clock, RefreshCw, ArrowLeft, CheckCircle, Menu, LayoutGrid, Users, Armchair, MoreVertical, ChevronDown, ChevronRight, ArrowRight, Plus, Flame } from 'lucide-react'
import { getSocket } from '@/lib/socket-client'
import { temaOperacao } from '@/lib/operacao-theme'
import { AvatarFuncao } from '@/components/operacao/avatares'

const C = temaOperacao('caixa')
const ORANGE = '#e8722e'
const ORANGE_LIGHT = '#f7a368'
const ORANGE_BG = 'rgba(232,114,46,0.12)'

type PinUser  = { id: string; name: string; avatarUrl: string | null }
type TenantInfo = { id: string; name: string; logo?: string | null }
type Step    = 'select' | 'pin' | 'dashboard'

type Mesa    = { id: string; numero: number; identificacao: string | null; cadeiras: number; status: string; pedidoAtivo?: { total: number; criadoEm: string } | null }
type PedidoItem = { id: string; quantidade: number; precoUnitario: number; observacao: string | null; product: { id: string; name: string } }
type Pagamento  = { id: string; formaPagamento: string; valor: number }
type Pedido  = { id: string; status: string; subtotal: number; taxaServico: number; total: number; criadoEm: string; itens: PedidoItem[]; pagamentos: Pagamento[]; garcom?: { name: string } | null }
type ConfigPdv = { formasPagamento: string[]; taxaServicoAtiva: boolean; taxaServico: number }

type DashView = 'mesas' | 'pedido' | 'finalizar'
type NfceStatus = { status: string | null; danfeUrl?: string | null; chaveAcesso?: string | null; motivoRejeicao?: string | null }

const FORMAS_LABEL: Record<string, string> = { DINHEIRO: 'Dinheiro', DEBITO: 'Débito', CREDITO: 'Crédito', PIX: 'Pix' }

function minutosDecorridos(desde: string, agora: Date): number {
  return Math.max(0, Math.floor((agora.getTime() - new Date(desde).getTime()) / 60000))
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
  const [filtroMesa, setFiltroMesa] = useState<'todas' | 'ocupadas' | 'livres'>('todas')
  const [menuAberto, setMenuAberto] = useState(false)
  const [cardMenu, setCardMenu]     = useState<string | null>(null)
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

  const statusChips = useMemo(() => {
    const ocupadas = mesas.filter((m) => m.status === 'OCUPADA').length
    const livres   = mesas.filter((m) => m.status === 'LIVRE').length
    const valorAberto = mesas.reduce((s, m) => s + (m.pedidoAtivo?.total ?? 0), 0)
    return { ocupadas, livres, valorAberto }
  }, [mesas])

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
    const chips = (
      <>
        <div style={{ padding: '4px 10px', borderRadius: 20, background: C.accentBg, border: `1px solid ${C.accent}`, fontSize: 12, fontWeight: 600, color: C.accentLight, whiteSpace: 'nowrap' }}>
          {statusChips.ocupadas} ocupada{statusChips.ocupadas !== 1 ? 's' : ''}
        </div>
        <div style={{ padding: '4px 10px', borderRadius: 20, background: C.surface2, border: `1px solid ${C.border}`, fontSize: 12, fontWeight: 600, color: C.green, whiteSpace: 'nowrap' }}>
          {statusChips.livres} livre{statusChips.livres !== 1 ? 's' : ''}
        </div>
        {statusChips.valorAberto > 0 && (
          <div style={{ padding: '4px 10px', borderRadius: 20, background: C.surface2, border: `1px solid ${C.border}`, fontSize: 12, fontWeight: 600, color: C.txt, whiteSpace: 'nowrap' }}>
            {formatPrice(statusChips.valorAberto)} em aberto
          </div>
        )}
      </>
    )
    const mesasFiltradas = mesas.filter((m) =>
      filtroMesa === 'todas' ? true : filtroMesa === 'ocupadas' ? m.status === 'OCUPADA' : m.status === 'LIVRE'
    )
    return (
      <div style={{ minHeight: '100vh', background: C.pageBg, display: 'flex', flexDirection: 'column' }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

        {/* Topbar */}
        <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {dashView !== 'mesas' ? (
              <button
                onClick={() => {
                  if (dashView === 'finalizar') { setDashView('pedido'); setFormaSelected('') }
                  else { setDashView('mesas'); setMesaAtiva(null); setPedido(null) }
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.txt2, display: 'flex', alignItems: 'center' }}
              >
                <ArrowLeft size={18} />
              </button>
            ) : (
              <div style={{ position: 'relative' }}>
                <button onClick={() => setMenuAberto((v) => !v)} title="Menu" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.txt2, display: 'flex', alignItems: 'center' }}>
                  <Menu size={20} />
                </button>
                {menuAberto && (
                  <div style={{ position: 'absolute', top: 30, left: 0, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 6, minWidth: 170, zIndex: 30, display: 'flex', flexDirection: 'column' }}>
                    <button onClick={() => { loadMesas(); setMenuAberto(false) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.txt2, fontSize: 13, textAlign: 'left', padding: '9px 10px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8 }}><RefreshCw size={14} /> Atualizar mesas</button>
                    <button onClick={() => { handleLogout(); setMenuAberto(false) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, fontSize: 13, textAlign: 'left', padding: '9px 10px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8 }}><ArrowLeft size={14} /> Sair</button>
                  </div>
                )}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <Flame size={22} style={{ color: '#e8722e' }} />
              <span style={{ fontSize: 15, fontWeight: 700, color: C.txt, letterSpacing: '.02em' }}>{(tenant?.name ?? slug).toUpperCase()}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 14, marginLeft: 4, borderLeft: `1px solid ${C.border}`, color: C.green, fontWeight: 600, fontSize: 13, borderBottom: `2px solid ${C.green}`, paddingBottom: 2 }}>
              <ShoppingCart size={16} /> CAIXA
            </div>
            {mesaAtiva && <span style={{ fontSize: 12, color: C.amber, background: C.accentBg, padding: '2px 8px', borderRadius: 4 }}>Mesa #{mesaAtiva.numero}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Clock size={13} style={{ color: C.subtle }} />
              <span style={{ fontSize: 13, color: C.subtle }}>{timeStr}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: C.txt2, fontSize: 13 }}>
              <ShoppingCart size={14} style={{ color: C.subtle }} /> {loggedUser?.name} <ChevronDown size={13} style={{ color: C.subtle }} />
            </div>
            <button onClick={handleLogout} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px', color: C.txt2, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ArrowLeft size={14} /> Sair
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
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '4px 4px 8px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h1 style={{ fontSize: 30, fontWeight: 700, color: C.txt, margin: 0 }}>
                    Bem-vindo ao <span style={{ color: C.green }}>Caixa</span>
                  </h1>
                  <p style={{ color: C.subtle, fontSize: 14, margin: '6px 0 14px' }}>
                    Selecione uma mesa para iniciar ou continuar um pedido.
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{chips}</div>
                </div>
                <AvatarFuncao funcao="caixa" size={132} />
              </div>

              {/* Filter tabs */}
              <div style={{ display: 'inline-flex', gap: 4, padding: 4, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 12, margin: '8px 0 18px' }}>
                {([
                  { k: 'todas' as const, label: 'Todas', Icon: LayoutGrid },
                  { k: 'ocupadas' as const, label: 'Ocupadas', Icon: Users },
                  { k: 'livres' as const, label: 'Livres', Icon: Armchair },
                ]).map(({ k, label, Icon }) => {
                  const active = filtroMesa === k
                  return (
                    <button
                      key={k}
                      onClick={() => setFiltroMesa(k)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 9,
                        background: active ? C.surface : 'transparent', border: 'none', cursor: 'pointer',
                        color: active ? C.green : C.subtle, fontWeight: active ? 700 : 500, fontSize: 13,
                        borderBottom: active ? `2px solid ${C.green}` : '2px solid transparent',
                      }}
                    >
                      <Icon size={15} /> {label}
                    </button>
                  )
                })}
              </div>

              {mesas.length === 0 && <p style={{ color: C.muted, fontSize: 13, marginTop: 12 }}>Nenhuma mesa cadastrada.</p>}
              {mesas.length > 0 && mesasFiltradas.length === 0 && (
                <p style={{ color: C.muted, fontSize: 13, marginTop: 12 }}>Nenhuma mesa {filtroMesa === 'ocupadas' ? 'ocupada' : 'livre'} no momento.</p>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                {mesasFiltradas.map((m) => {
                  const ocupada = m.status === 'OCUPADA'
                  const color = ocupada ? C.amber : C.green
                  return (
                    <div
                      key={m.id}
                      style={{
                        position: 'relative', background: C.surface,
                        border: `1px solid ${ocupada ? C.amber : C.border}`,
                        borderRadius: 16, padding: '18px 16px 16px',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      }}
                    >
                      {/* status pill */}
                      <div style={{ position: 'absolute', top: 12, left: 12, fontSize: 10, fontWeight: 700, letterSpacing: '.05em', color, background: ocupada ? C.accentBg : C.surface2, border: `1px solid ${color}`, padding: '3px 9px', borderRadius: 20 }}>
                        {ocupada ? 'OCUPADA' : 'LIVRE'}
                      </div>

                      {/* ⋮ card menu */}
                      <div style={{ position: 'absolute', top: 10, right: 8 }}>
                        <button onClick={() => setCardMenu(cardMenu === m.id ? null : m.id)} title="Ações" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.subtle, padding: 4, display: 'flex' }}>
                          <MoreVertical size={16} />
                        </button>
                        {cardMenu === m.id && (
                          <div style={{ position: 'absolute', top: 28, right: 0, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 6, minWidth: 150, zIndex: 20, display: 'flex', flexDirection: 'column' }}>
                            <button onClick={() => { setCardMenu(null); openMesa(m) }} disabled={!ocupada} style={{ background: 'none', border: 'none', cursor: ocupada ? 'pointer' : 'not-allowed', color: ocupada ? C.txt2 : C.dim, fontSize: 13, textAlign: 'left', padding: '8px 10px', borderRadius: 6 }}>Ver pedido</button>
                            <button onClick={() => { setCardMenu(null); loadMesas() }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.txt2, fontSize: 13, textAlign: 'left', padding: '8px 10px', borderRadius: 6 }}>Atualizar</button>
                          </div>
                        )}
                      </div>

                      {/* big table icon */}
                      <div style={{ marginTop: 20, width: 56, height: 56, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: ocupada ? C.accentBg : C.surface2, color }}>
                        <Armchair size={30} />
                      </div>

                      <span style={{ fontSize: 30, fontWeight: 800, color: C.txt, lineHeight: 1 }}>#{m.numero}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: C.txt2 }}>{m.identificacao || `Mesa ${m.numero}`}</span>

                      {ocupada && m.pedidoAtivo ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                          <span style={{ color: C.subtle, display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={12} /> {minutosDecorridos(m.pedidoAtivo.criadoEm, now)} min</span>
                          <span style={{ color: C.amber, fontWeight: 700 }}>{formatPrice(m.pedidoAtivo.total)}</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: C.muted }}>{ocupada ? 'Clique para ver o pedido' : `${m.cadeiras} lugares • livre`}</span>
                      )}

                      {/* CTA */}
                      <button
                        onClick={() => ocupada && openMesa(m)}
                        disabled={!ocupada}
                        style={{
                          marginTop: 10, width: '100%', padding: '11px 0', borderRadius: 10,
                          border: `1.5px solid ${color}`, background: 'transparent', color,
                          fontWeight: 700, fontSize: 13, cursor: ocupada ? 'pointer' : 'default', opacity: ocupada ? 1 : 0.7,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}
                      >
                        {ocupada ? <>Continuar pedido <ArrowRight size={15} /></> : <>Iniciar pedido <Plus size={15} /></>}
                      </button>
                    </div>
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

        {/* Footer */}
        <div style={{ flexShrink: 0, borderTop: `1px solid ${C.border}`, padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 11, color: C.muted, flexWrap: 'wrap' }}>
          <span>© {new Date().getFullYear()} {tenant?.name ?? slug} • Todos os direitos reservados</span>
          <span>Sistema de Gestão • Versão 1.0.0</span>
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

  const fullName = tenant?.name ?? slug
  const nameParts = fullName.trim().split(/\s+/)
  const lastWord = nameParts.length > 1 ? nameParts[nameParts.length - 1] : ''
  const firstWords = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : fullName

  return (
    <div style={{ minHeight: '100vh', background: `radial-gradient(ellipse 80% 60% at 50% 0%, rgba(232,114,46,0.22), transparent 60%), radial-gradient(circle at 50% 110%, rgba(232,114,46,0.12), transparent 55%), ${C.pageBg}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ marginBottom: -28, position: 'relative', zIndex: 2, filter: 'drop-shadow(0 8px 24px rgba(232,114,46,0.35))' }}>
        <AvatarFuncao funcao="caixa" size={120} />
      </div>

      {/* Glass card */}
      <div style={{ width: '100%', maxWidth: 400, background: 'rgba(20,16,8,0.72)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: `1px solid ${C.border}`, borderRadius: 22, padding: '44px 28px 28px', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.txt, margin: 0, letterSpacing: '.01em' }}>
            {firstWords}{lastWord && <> <span style={{ color: ORANGE }}>{lastWord}</span></>}
          </h1>
          <p style={{ fontSize: 13, color: C.subtle, margin: '6px 0 0' }}>Painel do Caixa</p>
          <div style={{ width: 56, height: 3, borderRadius: 2, background: ORANGE, margin: '16px auto 0' }} />
        </div>

        {step === 'select' && (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16 }}>
              <ShoppingCart size={15} style={{ color: ORANGE }} />
              <p style={{ fontSize: 13, color: C.txt2, margin: 0 }}>Selecione seu nome para continuar</p>
              <button onClick={loadPage} title="Atualizar lista" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.dim, padding: 4, display: 'flex', alignItems: 'center' }}>
                <RefreshCw size={13} />
              </button>
            </div>
            {users.length === 0 ? (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '32px 24px', textAlign: 'center' }}>
                <ShoppingCart size={32} style={{ color: C.dim, marginBottom: 10 }} />
                <p style={{ fontSize: 13, color: C.dim, margin: 0 }}>Nenhum caixa com PIN configurado</p>
                <p style={{ fontSize: 12, color: C.muted, margin: '6px 0 0' }}>Um administrador deve cadastrar caixas com PIN</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {users.map((u) => {
                  const sel = selected?.id === u.id
                  return (
                    <button
                      key={u.id}
                      onClick={() => selectUser(u)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, background: sel ? ORANGE_BG : C.surface, border: `1.5px solid ${sel ? ORANGE : C.border}`, cursor: 'pointer', textAlign: 'left', width: '100%' }}
                    >
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: ORANGE_BG, border: `1px solid ${ORANGE}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: ORANGE_LIGHT }}>{(u.name ?? '?')[0].toUpperCase()}</span>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 600, color: C.txt, flex: 1 }}>{u.name}</span>
                      <ChevronRight size={18} style={{ color: sel ? ORANGE : C.dim }} />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {step === 'pin' && (
          <div style={{ marginTop: 24 }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ margin: '0 auto 10px', width: 48, height: 48, borderRadius: '50%', background: ORANGE_BG, border: `2px solid ${ORANGE}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: ORANGE_LIGHT }}>{(selected?.name ?? '?')[0].toUpperCase()}</span>
              </div>
              <p style={{ fontSize: 15, fontWeight: 600, color: C.txt, margin: 0 }}>{selected?.name}</p>
              <p style={{ fontSize: 12, color: C.muted, margin: '2px 0 0' }}>Digite seu PIN</p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 20 }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ width: 14, height: 14, borderRadius: '50%', background: i < pin.length ? ORANGE_LIGHT : C.surface2, border: `2px solid ${i < pin.length ? ORANGE : C.border}`, transition: 'background 0.12s' }} />
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

      <p style={{ fontSize: 11, color: C.muted, margin: '22px 0 0', textAlign: 'center' }}>
        © {new Date().getFullYear()} {fullName} • Sistema de Gestão • Versão 1.0.0
      </p>
    </div>
  )
}
