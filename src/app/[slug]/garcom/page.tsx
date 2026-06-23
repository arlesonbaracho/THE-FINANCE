'use client'

import { useEffect, useState, useCallback } from 'react'
import { UtensilsCrossed, Delete, ArrowLeft, Plus, Minus, ShoppingCart, CheckCircle, PackageCheck, Flame, ChevronDown, ChevronRight, Clock, RefreshCw } from 'lucide-react'
import { getSocket } from '@/lib/socket-client'
import { temaOperacao } from '@/lib/operacao-theme'
import { AvatarFuncao } from '@/components/operacao/avatares'

// ── Tema roxo/índigo ──────────────────────────────────────────────────────────

const C = temaOperacao('garcom')
const ORANGE = '#e8722e'
const ORANGE_LIGHT = '#f7a368'
const ORANGE_BG = 'rgba(232,114,46,0.12)'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type GarcomUser = { id: string; name: string; avatarUrl: string | null }
type TenantInfo = { id: string; name: string }
type Mesa = { id: string; numero: number; identificacao: string | null; cadeiras: number; status: string; ambienteId: string | null }
type ProductIngredient = { ingredientId: string; quantity: number; ingredient: { currentQty: number } }
type Product = { id: string; name: string; salePrice: number; category: { id: string; name: string } | null; ingredients: ProductIngredient[]; available?: boolean }
type CartItem = { product: Product; quantidade: number; observacao: string }
type PedidoItemAtivo = { id: string; quantidade: number; precoUnitario: number; product: { id: string; name: string; salePrice: number }; observacao: string | null }
type PedidoAtivo = { id: string; status: string; itens: PedidoItemAtivo[]; subtotal: number; taxaServico: number; total: number }

type Step = 'select' | 'pin' | 'mesas' | 'cardapio' | 'pedido'

// ── Helpers ───────────────────────────────────────────────────────────────────

function isProdutoDisponivel(p: Product): boolean {
  if (!p.ingredients || p.ingredients.length === 0) return true
  return p.ingredients.every((ing) => ing.ingredient.currentQty >= ing.quantity)
}

function mesaStatusColor(s: string) {
  if (s === 'LIVRE') return C.green
  if (s === 'OCUPADA') return C.amber
  return C.purple
}

function formatPrice(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function GarcomPage({ params }: { params: { slug: string } }) {
  const { slug } = params

  const [tenant, setTenant]     = useState<TenantInfo | null>(null)
  const [users, setUsers]       = useState<GarcomUser[]>([])
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [step, setStep]         = useState<Step>('select')
  const [selected, setSelected] = useState<GarcomUser | null>(null)
  const [garcom, setGarcom]     = useState<GarcomUser | null>(null)
  const [pin, setPin]           = useState('')
  const [pinError, setPinError] = useState('')
  const [authing, setAuthing]   = useState(false)

  const [mesas, setMesas]           = useState<Mesa[]>([])
  const [mesaAtiva, setMesaAtiva]   = useState<Mesa | null>(null)
  const [products, setProducts]     = useState<Product[]>([])
  const [cart, setCart]             = useState<CartItem[]>([])
  const [sending, setSending]           = useState(false)
  const [success, setSuccess]           = useState(false)
  const [successType, setSuccessType]   = useState<'pedido' | 'entrega'>('pedido')
  const [pedidoAtivo, setPedidoAtivo]   = useState<PedidoAtivo | null>(null)
  const [confirmingEntrega, setConfirmingEntrega] = useState(false)

  // Observation modal
  const [obsProduct, setObsProduct] = useState<Product | null>(null)
  const [obsText, setObsText]       = useState('')
  const [obsQtd, setObsQtd]         = useState(1)

  // UI-only state — topbar hamburger menu toggle
  const [menuAberto, setMenuAberto] = useState(false)
  // Clock for topbar time display
  const [now, setNow] = useState(new Date())

  // Atualiza o relógio a cada minuto
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const loadInitial = useCallback(() => {
    setLoading(true)
    fetch(`/api/garcom/auth?slug=${slug}`)
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok || !d.tenant) { setNotFound(true); setLoading(false); return }
        setTenant(d.tenant)
        if (Array.isArray(d.users)) setUsers(d.users)
        setLoading(false)
      })
      .catch(() => { setNotFound(true); setLoading(false) })
  }, [slug])

  useEffect(() => { loadInitial() }, [loadInitial])

  useEffect(() => {
    if (pin.length === 4) authenticate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  async function authenticate() {
    if (!selected) return
    setAuthing(true)
    setPinError('')
    const res = await fetch('/api/garcom/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantSlug: slug, userId: selected.id, pin }),
    })
    const data = await res.json()
    setAuthing(false)
    if (!res.ok) {
      setPinError(data?.error ?? 'PIN incorreto')
      setPin('')
      return
    }
    setGarcom({ id: data.id, name: data.name, avatarUrl: data.avatarUrl })
    setPin('')
    if (data.tenantId) {
      try { getSocket().emit('join:tenant', data.tenantId) } catch { /* socket optional */ }
    }
    loadMesas()
  }

  async function loadMesas() {
    setStep('mesas')
    const r = await fetch(`/api/mesas?slug=${slug}`)
    if (r.ok) setMesas(await r.json())
  }

  async function selectMesa(mesa: Mesa) {
    if (mesa.status === 'RESERVADA') return
    setMesaAtiva(mesa)
    setCart([])
    setPedidoAtivo(null)
    if (mesa.status === 'OCUPADA') {
      const r = await fetch(`/api/pedidos?slug=${slug}&mesaId=${mesa.id}&status=ABERTO,EM_PREPARO,PRONTO`)
      if (r.ok) {
        const list = await r.json()
        if (list[0]) setPedidoAtivo(list[0])
      }
    }
    setStep('cardapio')
    const r = await fetch(`/api/products?slug=${slug}`)
    if (r.ok) {
      const prods: Product[] = await r.json()
      setProducts(prods.map((p) => ({ ...p, available: isProdutoDisponivel(p) })))
    }
  }

  function addToCart(product: Product, quantidade: number, observacao: string) {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.product.id === product.id && c.observacao === observacao)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], quantidade: next[idx].quantidade + quantidade }
        return next
      }
      return [...prev, { product, quantidade, observacao }]
    })
  }

  function removeFromCart(idx: number) {
    setCart((prev) => prev.filter((_, i) => i !== idx))
  }

  function changeQty(idx: number, delta: number) {
    setCart((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], quantidade: Math.max(1, next[idx].quantidade + delta) }
      return next
    })
  }

  async function sendPedido() {
    if (!mesaAtiva || !garcom || cart.length === 0) return
    setSending(true)

    if (pedidoAtivo && pedidoAtivo.status === 'ABERTO') {
      for (const c of cart) {
        await fetch(`/api/pedidos/${pedidoAtivo.id}/itens?slug=${slug}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: c.product.id,
            quantidade: c.quantidade,
            observacao: c.observacao || undefined,
          }),
        })
      }
    } else {
      const r = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mesaId: mesaAtiva.id,
          garcomId: garcom.id,
          itens: cart.map((c) => ({
            productId: c.product.id,
            quantidade: c.quantidade,
            observacao: c.observacao || undefined,
          })),
        }),
      })
      if (!r.ok) { setSending(false); return }
    }

    setSending(false)
    try { getSocket().emit('pedido:novo', { slug }) } catch { /* socket optional */ }
    setSuccessType('pedido')
    setSuccess(true)
    setCart([])
    setTimeout(() => {
      setSuccess(false)
      setMesaAtiva(null)
      setPedidoAtivo(null)
      loadMesas()
    }, 2000)
  }

  async function confirmarEntrega() {
    if (!pedidoAtivo) return
    setConfirmingEntrega(true)
    await fetch(`/api/pedidos/${pedidoAtivo.id}?slug=${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ENTREGUE' }),
    })
    setConfirmingEntrega(false)
    setSuccessType('entrega')
    setSuccess(true)
    setTimeout(() => {
      setSuccess(false)
      setMesaAtiva(null)
      setPedidoAtivo(null)
      loadMesas()
    }, 2000)
  }

  function handleLogout() {
    setStep('select')
    setSelected(null)
    setGarcom(null)
    setPin('')
    setPinError('')
    setCart([])
    setMesaAtiva(null)
    setPedidoAtivo(null)
  }

  // ── Not found ─────────────────────────────────────────────────────────────────

  if (notFound) return (
    <div style={{ minHeight: '100vh', background: C.pageBg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <UtensilsCrossed size={40} style={{ color: C.muted, marginBottom: 16 }} />
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

  // ── Select / PIN (login glass card) ──────────────────────────────────────────

  if (step === 'select' || step === 'pin') {
    const fullName = tenant?.name ?? slug
    const nameParts = fullName.trim().split(/\s+/)
    const lastWord = nameParts.length > 1 ? nameParts[nameParts.length - 1] : ''
    const firstWords = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : fullName

    return (
      <div style={{ minHeight: '100vh', background: `radial-gradient(ellipse 80% 60% at 50% 0%, rgba(232,114,46,0.22), transparent 60%), radial-gradient(circle at 50% 110%, rgba(232,114,46,0.12), transparent 55%), ${C.pageBg}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

        <div style={{ marginBottom: 'clamp(-44px, -4vw, -28px)', position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'center', filter: 'drop-shadow(0 14px 36px rgba(232,114,46,0.45))' }}>
          <AvatarFuncao funcao="garcom" size="clamp(220px,34vw,380px)" frame={false} />
        </div>

        {/* Glass card */}
        <div style={{ width: '100%', maxWidth: 400, background: 'rgba(20,16,8,0.72)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: `1px solid ${C.border}`, borderRadius: 22, padding: '44px 28px 28px', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: C.txt, margin: 0, letterSpacing: '.01em' }}>
              {firstWords}{lastWord && <> <span style={{ color: ORANGE }}>{lastWord}</span></>}
            </h1>
            <p style={{ fontSize: 13, color: C.subtle, margin: '6px 0 0' }}>Painel do Garçom</p>
            <div style={{ width: 56, height: 3, borderRadius: 2, background: ORANGE, margin: '16px auto 0' }} />
          </div>

          {/* ── Step: selecionar usuário ── */}
          {step === 'select' && (
            <div style={{ marginTop: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16 }}>
                <UtensilsCrossed size={15} style={{ color: ORANGE }} />
                <p style={{ fontSize: 13, color: C.txt2, margin: 0 }}>Selecione seu nome para continuar</p>
                <button onClick={loadInitial} title="Atualizar lista" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.dim, padding: 4, display: 'flex', alignItems: 'center' }}>
                  <RefreshCw size={13} />
                </button>
              </div>
              {users.length === 0 ? (
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '32px 24px', textAlign: 'center' }}>
                  <UtensilsCrossed size={32} style={{ color: C.dim, marginBottom: 10 }} />
                  <p style={{ fontSize: 13, color: C.dim, margin: 0 }}>Nenhum garçom com PIN configurado</p>
                  <p style={{ fontSize: 12, color: C.muted, margin: '6px 0 0' }}>Um administrador deve cadastrar garçons com PIN</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {users.map((u) => {
                    const sel = selected?.id === u.id
                    return (
                      <button
                        key={u.id}
                        onClick={() => { setSelected(u); setPin(''); setPinError(''); setStep('pin') }}
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

          {/* ── Step: digitar PIN ── */}
          {step === 'pin' && selected && (
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
              {pinError && <p style={{ fontSize: 13, color: C.red, textAlign: 'center', marginBottom: 14 }}>{pinError}</p>}
              {authing && <p style={{ fontSize: 13, color: C.subtle, textAlign: 'center', marginBottom: 14 }}>Verificando...</p>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {['1','2','3','4','5','6','7','8','9'].map((d) => (
                  <button key={d} onClick={() => { if (pin.length < 4) setPin((p) => p + d) }} disabled={authing} style={{ height: 58, borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.txt, fontSize: 22, fontWeight: 600, cursor: 'pointer' }}>{d}</button>
                ))}
                <button onClick={() => { setStep('select'); setSelected(null); setPin(''); setPinError('') }} disabled={authing} style={{ height: 58, borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.dim, fontSize: 11, cursor: 'pointer' }}>Voltar</button>
                <button onClick={() => { if (pin.length < 4) setPin((p) => p + '0') }} disabled={authing} style={{ height: 58, borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.txt, fontSize: 22, fontWeight: 600, cursor: 'pointer' }}>0</button>
                <button onClick={() => setPin((p) => p.slice(0, -1))} disabled={authing} style={{ height: 58, borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.subtle, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Delete size={20} />
                </button>
              </div>
            </div>
          )}
        </div>

        <p style={{ fontSize: 11, color: C.muted, margin: '22px 0 0', textAlign: 'center' }}>
          © {new Date().getFullYear()} {tenant?.name ?? slug} • Sistema de Gestão • Versão 1.0.0
        </p>
      </div>
    )
  }

  // ── Topbar compartilhado ──────────────────────────────────────────────────────

  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  const Topbar = () => (
    <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {(step === 'cardapio' || step === 'pedido') ? (
          <button
            onClick={() => { if (step === 'pedido') { setStep('cardapio') } else { setMesaAtiva(null); loadMesas() } }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.txt2, display: 'flex', alignItems: 'center' }}
          >
            <ArrowLeft size={18} />
          </button>
        ) : (
          <div style={{ position: 'relative' }}>
            <button onClick={() => setMenuAberto((v) => !v)} title="Menu" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.txt2, display: 'flex', alignItems: 'center' }}>
              ☰
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 14, marginLeft: 4, borderLeft: `1px solid ${C.border}`, color: C.accentLight, fontWeight: 600, fontSize: 13, borderBottom: `2px solid ${C.accent}`, paddingBottom: 2 }}>
          <UtensilsCrossed size={16} /> GARÇOM
        </div>
        {mesaAtiva && <span style={{ fontSize: 12, color: C.accentLight, background: C.accentBg, padding: '2px 8px', borderRadius: 4 }}>Mesa #{mesaAtiva.numero}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Clock size={13} style={{ color: C.subtle }} />
          <span style={{ fontSize: 13, color: C.subtle }}>{timeStr}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: C.txt2, fontSize: 13 }}>
          <UtensilsCrossed size={14} style={{ color: C.subtle }} /> {garcom?.name} <ChevronDown size={13} style={{ color: C.subtle }} />
        </div>
        <button onClick={handleLogout} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px', color: C.txt2, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={14} /> Sair
        </button>
      </div>
    </div>
  )

  // ── Footer compartilhado ──────────────────────────────────────────────────────

  const Footer = () => (
    <div style={{ flexShrink: 0, borderTop: `1px solid ${C.border}`, padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 11, color: C.muted, flexWrap: 'wrap' }}>
      <span>© {new Date().getFullYear()} {tenant?.name ?? slug} • Todos os direitos reservados</span>
      <span>Sistema de Gestão • Versão 1.0.0</span>
    </div>
  )

  // ── Mesas ─────────────────────────────────────────────────────────────────────

  if (step === 'mesas') return (
    <div style={{ minHeight: '100vh', background: C.pageBg, display: 'flex', flexDirection: 'column' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <Topbar />
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {/* Hero */}
        <div style={{ position: 'relative', padding: '4px 4px 8px', minHeight: 'clamp(120px, 15vw, 200px)' }}>
          <div style={{ maxWidth: '100%', paddingRight: 'clamp(150px, 22vw, 300px)' }}>
            <h1 style={{ fontSize: 'clamp(24px, 3vw, 32px)', fontWeight: 700, color: C.txt, margin: 0 }}>
              Bem-vindo ao <span style={{ color: C.accentLight }}>Garçom</span>
            </h1>
            <p style={{ color: C.subtle, fontSize: 14, margin: '6px 0 14px' }}>
              Selecione uma mesa para abrir ou continuar um pedido.
            </p>
          </div>
          <div style={{ position: 'absolute', top: -8, right: 'clamp(0px, 2vw, 32px)', pointerEvents: 'none', filter: 'drop-shadow(0 10px 26px rgba(0,0,0,0.4))' }}>
            <AvatarFuncao funcao="garcom" size="clamp(130px,17vw,230px)" frame={false} />
          </div>
        </div>

        <p style={{ color: C.txt2, fontSize: 14, margin: '0 0 16px' }}>
          Selecione <strong style={{ color: C.green }}>LIVRE</strong> para novo pedido ou <strong style={{ color: C.amber }}>OCUPADA</strong> para adicionar itens:
        </p>
        {mesas.length === 0 && <p style={{ color: C.muted, fontSize: 13 }}>Nenhuma mesa cadastrada.</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
          {mesas.map((m) => {
            const interativa = m.status === 'LIVRE' || m.status === 'OCUPADA'
            const color = mesaStatusColor(m.status)
            return (
              <button
                key={m.id}
                onClick={() => interativa && selectMesa(m)}
                disabled={!interativa}
                style={{
                  padding: '14px 10px',
                  background: interativa ? C.surface : C.surface2,
                  border: `2px solid ${interativa ? color : C.border}`,
                  borderRadius: 10,
                  cursor: interativa ? 'pointer' : 'default',
                  opacity: interativa ? 1 : 0.45,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 20, color: interativa ? C.txt : C.txt2 }}>#{m.numero}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color, textTransform: 'uppercase' }}>{m.status}</span>
                {m.identificacao && <span style={{ fontSize: 10, color: C.muted }}>{m.identificacao}</span>}
              </button>
            )
          })}
        </div>
      </div>
      <Footer />
    </div>
  )

  // ── Cardápio ──────────────────────────────────────────────────────────────────

  const categorias = Array.from(new Set(products.map((p) => p.category?.name ?? 'Sem categoria')))
  const cartCount = cart.reduce((s, c) => s + c.quantidade, 0)
  const cartTotal = cart.reduce((s, c) => s + c.product.salePrice * c.quantidade, 0)

  if (step === 'cardapio') return (
    <div style={{ minHeight: '100vh', background: C.pageBg, display: 'flex', flexDirection: 'column' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <Topbar />

      {/* Obs modal */}
      {obsProduct && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, width: '100%', maxWidth: 340 }}>
            <h3 style={{ margin: '0 0 4px', color: C.txt, fontSize: 16 }}>{obsProduct.name}</h3>
            <p style={{ margin: '0 0 16px', color: C.txt2, fontSize: 13 }}>{formatPrice(obsProduct.salePrice)} · unidade</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, justifyContent: 'center' }}>
              <button onClick={() => setObsQtd((v) => Math.max(1, v - 1))} style={{ width: 36, height: 36, borderRadius: 8, background: C.surface2, border: `1px solid ${C.border}`, color: C.txt, fontSize: 18, cursor: 'pointer' }}><Minus size={16} /></button>
              <span style={{ color: C.txt, fontWeight: 600, fontSize: 18, minWidth: 28, textAlign: 'center' }}>{obsQtd}</span>
              <button onClick={() => setObsQtd((v) => v + 1)} style={{ width: 36, height: 36, borderRadius: 8, background: C.accent, border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer' }}><Plus size={16} /></button>
            </div>
            <textarea
              value={obsText}
              onChange={(e) => setObsText(e.target.value)}
              placeholder="Observação (ex: sem cebola, bem passado…)"
              rows={2}
              style={{ width: '100%', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 10px', color: C.txt, fontSize: 13, resize: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => setObsProduct(null)} style={{ flex: 1, padding: '10px 0', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, color: C.txt2, cursor: 'pointer' }}>Cancelar</button>
              <button
                onClick={() => {
                  addToCart(obsProduct, obsQtd, obsText)
                  setObsProduct(null)
                  setObsText('')
                  setObsQtd(1)
                }}
                style={{ flex: 1, padding: '10px 0', background: C.accent, border: 'none', borderRadius: 8, color: '#fff', fontWeight: 600, cursor: 'pointer' }}
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', paddingBottom: cart.length > 0 ? 100 : 20 }}>
        {pedidoAtivo && pedidoAtivo.status === 'PRONTO' && (
          <div style={{ background: '#0d2318', border: `1px solid ${C.green}`, borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <PackageCheck size={18} style={{ color: C.green }} />
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.green }}>Pedido PRONTO para entrega!</p>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: C.txt2 }}>
              {pedidoAtivo.itens.length} {pedidoAtivo.itens.length === 1 ? 'item' : 'itens'} · {formatPrice(pedidoAtivo.total)}
            </p>
            <button
              onClick={confirmarEntrega}
              disabled={confirmingEntrega}
              style={{ width: '100%', padding: '10px 0', background: C.green, border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 14, cursor: confirmingEntrega ? 'not-allowed' : 'pointer' }}
            >
              {confirmingEntrega ? 'Confirmando…' : 'Confirmar entrega na mesa'}
            </button>
          </div>
        )}
        {pedidoAtivo && pedidoAtivo.status !== 'PRONTO' && (
          <div style={{ background: C.accentBg, border: `1px solid ${C.accent}`, borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.accentLight }}>Pedido em aberto — Mesa #{mesaAtiva?.numero}</p>
              <p style={{ margin: 0, fontSize: 12, color: C.txt2 }}>
                {pedidoAtivo.itens.length} {pedidoAtivo.itens.length === 1 ? 'item' : 'itens'} · {formatPrice(pedidoAtivo.total)}
                {pedidoAtivo.status !== 'ABERTO' && <span style={{ color: C.amber, marginLeft: 8 }}>({pedidoAtivo.status})</span>}
              </p>
            </div>
            <button
              onClick={() => setStep('pedido')}
              style={{ background: 'none', border: `1px solid ${C.accent}`, borderRadius: 6, padding: '4px 10px', color: C.accentLight, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Ver pedido
            </button>
          </div>
        )}
        {categorias.map((cat) => (
          <div key={cat} style={{ marginBottom: 24 }}>
            <h3 style={{ color: C.accentLight, fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 10px' }}>{cat}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {products.filter((p) => (p.category?.name ?? 'Sem categoria') === cat).map((p) => {
                const avail = p.available !== false
                return (
                  <div key={p.id} style={{
                    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
                    padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    opacity: avail ? 1 : 0.45,
                  }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: C.txt }}>{p.name}</p>
                      <p style={{ margin: 0, fontSize: 12, color: C.txt2 }}>{formatPrice(p.salePrice)}</p>
                      {!avail && <p style={{ margin: 0, fontSize: 11, color: C.red }}>Fora de estoque</p>}
                    </div>
                    {avail && (
                      <button
                        onClick={() => { setObsProduct(p); setObsQtd(1); setObsText('') }}
                        style={{ width: 36, height: 36, borderRadius: 8, background: C.accent, border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Plus size={18} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Floating cart button */}
      {cartCount > 0 && (
        <div style={{ position: 'fixed', bottom: 20, left: 20, right: 20, zIndex: 40 }}>
          <button
            onClick={() => setStep('pedido')}
            style={{
              width: '100%', padding: '14px 20px', borderRadius: 12,
              background: C.accent, border: 'none', color: '#fff',
              fontSize: 15, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShoppingCart size={18} />
              <span>{cartCount} {cartCount === 1 ? 'item' : 'itens'}</span>
            </div>
            <span>{formatPrice(cartTotal)}</span>
          </button>
        </div>
      )}
    </div>
  )

  // ── Revisar pedido ────────────────────────────────────────────────────────────

  if (step === 'pedido') return (
    <div style={{ minHeight: '100vh', background: C.pageBg, display: 'flex', flexDirection: 'column' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <Topbar />

      {success && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 100, gap: 12 }}>
          {successType === 'entrega' ? (
            <>
              <PackageCheck size={64} style={{ color: C.green }} />
              <p style={{ color: C.txt, fontWeight: 600, fontSize: 18, margin: 0 }}>Entrega confirmada!</p>
              <p style={{ color: C.txt2, fontSize: 14, margin: 0 }}>Pedido marcado como entregue.</p>
            </>
          ) : (
            <>
              <CheckCircle size={64} style={{ color: C.green }} />
              <p style={{ color: C.txt, fontWeight: 600, fontSize: 18, margin: 0 }}>Pedido enviado!</p>
              <p style={{ color: C.txt2, fontSize: 14, margin: 0 }}>A cozinha foi notificada.</p>
            </>
          )}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', paddingBottom: 100 }}>
        <h2 style={{ color: C.txt, fontWeight: 600, fontSize: 16, margin: '0 0 16px' }}>Revisão do Pedido — Mesa #{mesaAtiva?.numero}</h2>

        {pedidoAtivo && pedidoAtivo.itens.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ color: C.muted, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px' }}>Já pedido</p>
            {pedidoAtivo.itens.map((item) => (
              <div key={item.id} style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10, opacity: 0.7 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: C.txt }}>{item.product.name}</p>
                  {item.observacao && <p style={{ margin: 0, fontSize: 12, color: C.muted, fontStyle: 'italic' }}>{item.observacao}</p>}
                  <p style={{ margin: 0, fontSize: 12, color: C.txt2 }}>{item.quantidade}x · {formatPrice(item.precoUnitario * item.quantidade)}</p>
                </div>
                <span style={{ fontSize: 11, color: C.muted, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4, padding: '2px 6px' }}>enviado</span>
              </div>
            ))}
          </div>
        )}

        {cart.length > 0 && (
          <div>
            {pedidoAtivo && <p style={{ color: C.accentLight, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px' }}>Adicionando</p>}
            {cart.map((item, i) => (
              <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: C.txt }}>{item.product.name}</p>
                  {item.observacao && <p style={{ margin: 0, fontSize: 12, color: C.muted, fontStyle: 'italic' }}>{item.observacao}</p>}
                  <p style={{ margin: 0, fontSize: 12, color: C.txt2 }}>{formatPrice(item.product.salePrice * item.quantidade)}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => changeQty(i, -1)} style={{ width: 28, height: 28, borderRadius: 6, background: C.surface2, border: `1px solid ${C.border}`, color: C.txt, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={13} /></button>
                  <span style={{ color: C.txt, fontWeight: 600, minWidth: 20, textAlign: 'center' }}>{item.quantidade}</span>
                  <button onClick={() => changeQty(i, 1)} style={{ width: 28, height: 28, borderRadius: 6, background: C.surface2, border: `1px solid ${C.border}`, color: C.txt, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={13} /></button>
                  <button onClick={() => removeFromCart(i)} style={{ width: 28, height: 28, borderRadius: 6, background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 16 }}>×</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', marginTop: 16 }}>
          {pedidoAtivo && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: C.txt2, fontSize: 13, marginBottom: cart.length > 0 ? 6 : 0 }}>
              <span>Já pedido</span>
              <span>{formatPrice(pedidoAtivo.total)}</span>
            </div>
          )}
          {cart.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: C.txt, fontWeight: 700, fontSize: 15 }}>
              <span>{pedidoAtivo ? 'Adicionando' : 'Total'}</span>
              <span>{formatPrice(cart.reduce((s, c) => s + c.product.salePrice * c.quantidade, 0))}</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ position: 'fixed', bottom: 20, left: 20, right: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {pedidoAtivo?.status === 'PRONTO' && (
          <button
            onClick={confirmarEntrega}
            disabled={confirmingEntrega}
            style={{
              width: '100%', padding: '14px 0', borderRadius: 12,
              background: confirmingEntrega ? C.muted : C.green, border: 'none', color: '#fff',
              fontSize: 15, fontWeight: 700, cursor: confirmingEntrega ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <PackageCheck size={18} />
            {confirmingEntrega ? 'Confirmando…' : 'Confirmar entrega na mesa'}
          </button>
        )}
        {pedidoAtivo?.status !== 'PRONTO' && (
          <button
            onClick={sendPedido}
            disabled={sending || cart.length === 0}
            style={{
              width: '100%', padding: '14px 0', borderRadius: 12,
              background: sending || cart.length === 0 ? C.muted : C.accent, border: 'none', color: '#fff',
              fontSize: 15, fontWeight: 700, cursor: sending || cart.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {sending ? 'Enviando…' : pedidoAtivo ? 'Adicionar ao pedido' : 'Confirmar pedido'}
          </button>
        )}
      </div>
    </div>
  )

  return null
}
