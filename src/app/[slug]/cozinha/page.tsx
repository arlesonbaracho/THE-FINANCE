'use client'

import { useEffect, useState, useCallback } from 'react'
import { ChefHat, Delete, Clock, RefreshCw } from 'lucide-react'

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

  // Atualiza o relógio a cada minuto
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const loadKitchen = useCallback(() => {
    setLoading(true)
    fetch(`/api/cozinha/auth?slug=${slug}`)
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok || !d.tenant) { setNotFound(true); setLoading(false); return }
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
    const dateStr = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
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

        {/* Conteúdo */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 24px' }}>
          {/* Card boas-vindas */}
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 12, padding: '20px 24px',
            width: '100%', maxWidth: 560, marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 16,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: C.greenBg, border: `2px solid ${C.green}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: C.greenLight }}>
                {kitchenUser?.name?.[0]?.toUpperCase() ?? '?'}
              </span>
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 600, color: C.txt, margin: 0 }}>
                Olá, {kitchenUser?.name}!
              </p>
              <p style={{ fontSize: 12, color: C.muted, margin: '2px 0 0', textTransform: 'capitalize' }}>
                {dateStr}
              </p>
            </div>
          </div>

          {/* Área de pedidos */}
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 12, width: '100%', maxWidth: 560, overflow: 'hidden',
          }}>
            <div style={{
              padding: '12px 20px', background: C.surface2,
              borderBottom: `1px solid ${C.border}`,
            }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                PEDIDOS EM ABERTO
              </span>
            </div>
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <ChefHat size={40} style={{ color: C.dim, marginBottom: 12 }} />
              <p style={{ fontSize: 14, color: C.subtle, margin: 0 }}>
                Nenhum pedido no momento
              </p>
              <p style={{ fontSize: 12, color: C.muted, margin: '4px 0 0' }}>
                Os pedidos aparecerão aqui quando forem enviados
              </p>
            </div>
          </div>
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
              onClick={loadKitchen}
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
