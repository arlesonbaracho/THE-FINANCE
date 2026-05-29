'use client'

import { useEffect, useState, useCallback } from 'react'
import { ChefHat, Delete, Clock, RefreshCw } from 'lucide-react'
import { getSocket } from '@/lib/socket-client'
import { fetchCached, invalidateCache } from '@/lib/client-cache'

// ── Tema verde-escuro (igual ao resto do projeto) ──────────────────────────────

const C = {
  pageBg:     '#0f1714',
  surface:    '#111a16',
  surface2:   '#0d1410',
  border:     '#1e2e26',
  borderLight:'#141e19',
  txt:        '#e8f0ec',
  txt2:       '#c8dcd2',
  muted:      '#3d6050',
  dim:        '#2d5040',
  subtle:     '#5a7a6a',
  green:      '#2a9d6f',
  greenLight: '#4bc994',
  greenBg:    '#0d2b1f',
  red:        '#e05252',
  redBg:      '#1f0a0a',
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

type KitchenUser = { id: string; name: string; avatarUrl: string | null }
type TenantInfo  = { id: string; name: string }
type Step        = 'select' | 'pin' | 'dashboard'

type PedidoItem  = { id: string; quantidade: number; product: { name: string }; observacao: string | null }
type Pedido      = { id: string; status: string; criadoEm: string; itens: PedidoItem[]; mesa: { numero: number } | null; garcom: { name: string } | null }

const STATUS_ORDER: Record<string, number> = { ABERTO: 0, EM_PREPARO: 1, PRONTO: 2 }

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 1) return 'agora'
  if (diff < 60) return `${diff} min`
  return `${Math.floor(diff / 60)}h${diff % 60 > 0 ? ` ${diff % 60}min` : ''}`
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function CozinhaPage({ params }: { params: { slug: string } }) {
  const { slug } = params

  const [tenant, setTenant]         = useState<TenantInfo | null>(null)
  const [users, setUsers]           = useState<KitchenUser[]>([])
  const [loading, setLoading]       = useState(true)
  const [notFound, setNotFound]     = useState(false)
  const [step, setStep]             = useState<Step>('select')
  const [selected, setSelected]     = useState<KitchenUser | null>(null)
  const [kitchenUser, setKitchenUser] = useState<KitchenUser | null>(null)
  const [pin, setPin]               = useState('')
  const [error, setError]           = useState('')
  const [authing, setAuthing]       = useState(false)
  const [now, setNow]               = useState(new Date())
  const [pedidos, setPedidos]       = useState<Pedido[]>([])
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // Atualiza o relógio a cada minuto
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const loadPedidos = useCallback(async () => {
    const r = await fetch(`/api/pedidos?slug=${slug}&status=ABERTO,EM_PREPARO,PRONTO`)
    if (r.ok) {
      const list: Pedido[] = await r.json()
      setPedidos(list.sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime()))
    }
  }, [slug])

  useEffect(() => {
    if (step !== 'dashboard') return
    loadPedidos()
    let socket: ReturnType<typeof getSocket> | null = null
    try {
      socket = getSocket()
      socket.on('pedido:novo', loadPedidos)
      socket.on('pedido:status', loadPedidos)
      return () => {
        socket?.off('pedido:novo', loadPedidos)
        socket?.off('pedido:status', loadPedidos)
      }
    } catch { /* socket optional */ }
  }, [step, loadPedidos])

  async function updateStatus(pedidoId: string, newStatus: string) {
    setUpdatingId(pedidoId)
    const r = await fetch(`/api/pedidos/${pedidoId}?slug=${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setUpdatingId(null)
    if (r.ok) await loadPedidos()
  }

  const loadKitchen = useCallback((fresh = false) => {
    setLoading(true)
    if (fresh) invalidateCache(`/api/cozinha/auth?slug=${slug}`)
    fetchCached<{ tenant: TenantInfo | null; users: KitchenUser[] }>(`/api/cozinha/auth?slug=${slug}`)
      .then((d) => {
        if (!d.tenant) { setNotFound(true); setLoading(false); return }
        setTenant(d.tenant)
        if (Array.isArray(d.users)) setUsers(d.users)
        setLoading(false)
      })
      .catch(() => { setNotFound(true); setLoading(false) })
  }, [slug])

  useEffect(() => { loadKitchen() }, [loadKitchen])

  function selectUser(user: KitchenUser) {
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
    const res = await fetch('/api/cozinha/auth', {
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
    // Armazena usuário logado em estado React (sem sessionStorage, sem redirect)
    setKitchenUser({ id: data.id, name: data.name, avatarUrl: data.avatarUrl })
    setStep('dashboard')
    setPin('')
  }

  function handleLogout() {
    setStep('select')
    setSelected(null)
    setKitchenUser(null)
    setPin('')
    setError('')
  }

  // ── Not found ─────────────────────────────────────────────────────────────

  if (notFound) return (
    <div style={{
      minHeight: '100vh', background: C.pageBg,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <ChefHat size={40} style={{ color: C.dim, marginBottom: 16 }} />
      <p style={{ fontSize: 16, fontWeight: 600, color: C.txt2, margin: 0 }}>
        Restaurante não encontrado
      </p>
      <p style={{ fontSize: 13, color: C.muted, margin: '8px 0 20px', textAlign: 'center' }}>
        O código &quot;{slug}&quot; não corresponde a nenhum restaurante cadastrado.
      </p>
      <a href="/auth/login" style={{ fontSize: 13, color: C.greenLight, textDecoration: 'none' }}>
        ← Voltar ao login
      </a>
    </div>
  )

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.pageBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: `2px solid ${C.border}`, borderTopColor: C.greenLight, animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── Dashboard (pós-login) ──────────────────────────────────────────────────

  if (step === 'dashboard') {
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

    return (
      <div style={{ minHeight: '100vh', background: C.pageBg, display: 'flex', flexDirection: 'column' }}>
        {/* Topbar */}
        <div style={{
          background: C.surface, borderBottom: `1px solid ${C.border}`,
          padding: '14px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ChefHat size={20} style={{ color: C.greenLight }} />
            <span style={{ fontSize: 16, fontWeight: 600, color: C.txt }}>{tenant?.name ?? slug}</span>
            <span style={{ fontSize: 13, color: C.muted }}>/ Cozinha</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={13} style={{ color: C.subtle }} />
              <span style={{ fontSize: 13, color: C.subtle }}>{timeStr}</span>
            </div>
            <span style={{ fontSize: 13, color: C.txt2, fontWeight: 500 }}>{kitchenUser?.name}</span>
            <button
              onClick={handleLogout}
              style={{
                fontSize: 12, color: C.muted, background: 'none',
                border: `1px solid ${C.border}`, borderRadius: 6,
                padding: '5px 12px', cursor: 'pointer', transition: 'color 0.12s, border-color 0.12s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = C.txt2; e.currentTarget.style.borderColor = C.subtle }}
              onMouseLeave={(e) => { e.currentTarget.style.color = C.muted; e.currentTarget.style.borderColor = C.border }}
            >
              Sair
            </button>
          </div>
        </div>

        {/* KDS — board de pedidos */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <p style={{ margin: 0, color: C.txt2, fontSize: 13 }}>
              Olá, <strong style={{ color: C.txt }}>{kitchenUser?.name}</strong> — {pedidos.length} pedido{pedidos.length !== 1 ? 's' : ''} em aberto
            </p>
            <button onClick={loadPedidos} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.dim }}>
              <RefreshCw size={14} />
            </button>
          </div>

          {pedidos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <ChefHat size={48} style={{ color: C.dim, marginBottom: 12 }} />
              <p style={{ fontSize: 14, color: C.subtle, margin: 0 }}>Nenhum pedido no momento</p>
              <p style={{ fontSize: 12, color: C.muted, margin: '4px 0 0' }}>Os pedidos aparecerão aqui quando forem enviados</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
              {pedidos.map((p) => {
                const isAberto    = p.status === 'ABERTO'
                const isEmPreparo = p.status === 'EM_PREPARO'
                const isPronto    = p.status === 'PRONTO'
                const borderColor = isAberto ? C.border : isEmPreparo ? C.green : C.muted
                const statusLabel = isAberto ? 'Aguardando' : isEmPreparo ? 'Em preparo' : 'Pronto'
                const statusColor = isAberto ? C.muted : isEmPreparo ? C.green : C.greenLight
                const isUpdating  = updatingId === p.id
                return (
                  <div key={p.id} style={{ background: C.surface, border: `2px solid ${borderColor}`, borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ padding: '10px 14px', background: C.surface2, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 16, color: C.txt }}>
                          Mesa #{p.mesa?.numero ?? '?'}
                        </span>
                        {p.garcom && <span style={{ fontSize: 12, color: C.muted, marginLeft: 8 }}>{p.garcom.name}</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: C.muted }}>{timeAgo(p.criadoEm)}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: statusColor, background: statusColor + '22', padding: '2px 6px', borderRadius: 4 }}>
                          {statusLabel}
                        </span>
                      </div>
                    </div>
                    <div style={{ padding: '10px 14px' }}>
                      {p.itens.map((item) => (
                        <div key={item.id} style={{ padding: '4px 0', borderBottom: `1px solid ${C.borderLight}` }}>
                          <span style={{ fontSize: 14, color: C.txt }}>{item.quantidade}× {item.product.name}</span>
                          {item.observacao && <p style={{ margin: 0, fontSize: 12, color: C.muted, fontStyle: 'italic' }}>{item.observacao}</p>}
                        </div>
                      ))}
                    </div>
                    <div style={{ padding: '10px 14px', display: 'flex', gap: 8 }}>
                      {isAberto && (
                        <button
                          onClick={() => !isUpdating && updateStatus(p.id, 'EM_PREPARO')}
                          disabled={isUpdating}
                          style={{ flex: 1, padding: '8px 0', background: C.green, border: 'none', borderRadius: 8, color: '#fff', fontWeight: 600, fontSize: 13, cursor: isUpdating ? 'not-allowed' : 'pointer', opacity: isUpdating ? 0.6 : 1 }}
                        >
                          {isUpdating ? '...' : 'Iniciar'}
                        </button>
                      )}
                      {isEmPreparo && (
                        <button
                          onClick={() => !isUpdating && updateStatus(p.id, 'PRONTO')}
                          disabled={isUpdating}
                          style={{ flex: 1, padding: '8px 0', background: C.green, border: 'none', borderRadius: 8, color: '#fff', fontWeight: 600, fontSize: 13, cursor: isUpdating ? 'not-allowed' : 'pointer', opacity: isUpdating ? 0.6 : 1 }}
                        >
                          {isUpdating ? '...' : 'Pronto ✓'}
                        </button>
                      )}
                      {isPronto && (
                        <div style={{ flex: 1, textAlign: 'center', fontSize: 13, color: C.greenLight, fontWeight: 600 }}>
                          ✓ Aguardando retirada
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Tela de login (select / pin) ───────────────────────────────────────────

  return (
    <div style={{
      minHeight: '100vh', background: C.pageBg,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      {/* Header */}
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <div style={{
          margin: '0 auto 12px', width: 56, height: 56, borderRadius: 16,
          background: C.greenBg, border: `1px solid ${C.green}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ChefHat size={26} style={{ color: C.greenLight }} />
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: C.txt, margin: 0 }}>
          {tenant?.name ?? slug}
        </h1>
        <p style={{ fontSize: 13, color: C.muted, margin: '4px 0 0' }}>Painel da Cozinha</p>
      </div>

      {/* ── Step: selecionar usuário ── */}
      {step === 'select' && (
        <div style={{ width: '100%', maxWidth: 340 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 14 }}>
            <p style={{ fontSize: 13, color: C.subtle, margin: 0 }}>Selecione seu nome</p>
            <button
              onClick={() => loadKitchen(true)}
              title="Atualizar lista"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.dim, padding: 4, display: 'flex', alignItems: 'center' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = C.subtle }}
              onMouseLeave={(e) => { e.currentTarget.style.color = C.dim }}
            >
              <RefreshCw size={13} />
            </button>
          </div>
          {users.length === 0 ? (
            <div style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 10, padding: '32px 24px', textAlign: 'center',
            }}>
              <ChefHat size={32} style={{ color: C.dim, marginBottom: 10 }} />
              <p style={{ fontSize: 13, color: C.dim, margin: 0 }}>Nenhum usuário com PIN configurado</p>
              <p style={{ fontSize: 12, color: C.muted, margin: '6px 0 0' }}>
                Um administrador deve cadastrar cozinheiros com PIN
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => selectUser(u)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px', borderRadius: 10,
                    background: C.surface, border: `1px solid ${C.border}`,
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                    transition: 'background 0.1s, border-color 0.1s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#0d1a14'; e.currentTarget.style.borderColor = C.green }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = C.surface; e.currentTarget.style.borderColor = C.border }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: C.greenBg, border: `1px solid ${C.green}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.greenLight }}>
                      {(u.name ?? '?')[0].toUpperCase()}
                    </span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 500, color: C.txt2 }}>{u.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Step: digitar PIN ── */}
      {step === 'pin' && (
        <div style={{ width: '100%', maxWidth: 280 }}>
          {/* Avatar do usuário selecionado */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{
              margin: '0 auto 10px', width: 48, height: 48, borderRadius: '50%',
              background: C.greenBg, border: `2px solid ${C.green}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: C.greenLight }}>
                {(selected?.name ?? '?')[0].toUpperCase()}
              </span>
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: C.txt, margin: 0 }}>{selected?.name}</p>
            <p style={{ fontSize: 12, color: C.muted, margin: '2px 0 0' }}>Digite seu PIN</p>
          </div>

          {/* Indicadores de dígitos */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 20 }}>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  width: 14, height: 14, borderRadius: '50%',
                  background: i < pin.length ? C.greenLight : C.surface2,
                  border: `2px solid ${i < pin.length ? C.green : C.border}`,
                  transition: 'background 0.12s, border-color 0.12s',
                }}
              />
            ))}
          </div>

          {/* Mensagens */}
          {error && (
            <p style={{ fontSize: 13, color: C.red, textAlign: 'center', marginBottom: 14, fontWeight: 500 }}>
              {error}
            </p>
          )}
          {authing && (
            <p style={{ fontSize: 13, color: C.subtle, textAlign: 'center', marginBottom: 14 }}>
              Verificando...
            </p>
          )}

          {/* Teclado numérico */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {['1','2','3','4','5','6','7','8','9'].map((d) => (
              <button
                key={d}
                onClick={() => pressDigit(d)}
                disabled={authing}
                style={{
                  height: 58, borderRadius: 10, border: `1px solid ${C.border}`,
                  background: C.surface, color: C.txt,
                  fontSize: 22, fontWeight: 600, cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => { if (!authing) e.currentTarget.style.background = C.surface2 }}
                onMouseLeave={(e) => { e.currentTarget.style.background = C.surface }}
              >
                {d}
              </button>
            ))}

            {/* Voltar */}
            <button
              onClick={() => { setStep('select'); setSelected(null); setPin(''); setError('') }}
              style={{
                height: 58, borderRadius: 10, border: `1px solid ${C.border}`,
                background: C.surface, color: C.dim,
                fontSize: 11, cursor: 'pointer',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = C.surface2 }}
              onMouseLeave={(e) => { e.currentTarget.style.background = C.surface }}
            >
              Voltar
            </button>

            {/* 0 */}
            <button
              onClick={() => pressDigit('0')}
              disabled={authing}
              style={{
                height: 58, borderRadius: 10, border: `1px solid ${C.border}`,
                background: C.surface, color: C.txt,
                fontSize: 22, fontWeight: 600, cursor: 'pointer',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => { if (!authing) e.currentTarget.style.background = C.surface2 }}
              onMouseLeave={(e) => { e.currentTarget.style.background = C.surface }}
            >
              0
            </button>

            {/* Apagar */}
            <button
              onClick={backspace}
              disabled={authing}
              style={{
                height: 58, borderRadius: 10, border: `1px solid ${C.border}`,
                background: C.surface, color: C.subtle,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => { if (!authing) e.currentTarget.style.background = C.surface2 }}
              onMouseLeave={(e) => { e.currentTarget.style.background = C.surface }}
            >
              <Delete size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
