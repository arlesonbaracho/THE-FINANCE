'use client'

import { useEffect, useState, useCallback } from 'react'
import { Package, Delete, Clock, RefreshCw } from 'lucide-react'

const C = {
  pageBg:      '#0d1118',
  surface:     '#10151e',
  surface2:    '#0a0f16',
  border:      '#1a2438',
  borderLight: '#111928',
  txt:         '#e8ecf0',
  txt2:        '#c8d2dc',
  muted:       '#3d5068',
  dim:         '#2d4058',
  subtle:      '#5a6a7a',
  accent:      '#2a6fb4',
  accentLight: '#4b8fd4',
  accentBg:    '#0a1a2b',
  red:         '#e05252',
  redBg:       '#1f0a0a',
}

type PinUser    = { id: string; name: string; avatarUrl: string | null }
type TenantInfo = { id: string; name: string }
type Step       = 'select' | 'pin' | 'dashboard'

export default function EstoquePage({ params }: { params: { slug: string } }) {
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

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const loadPage = useCallback(() => {
    setLoading(true)
    fetch(`/api/estoque/auth?slug=${slug}`)
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
    const res = await fetch('/api/estoque/auth', {
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
  }

  if (notFound) return (
    <div style={{
      minHeight: '100vh', background: C.pageBg,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <Package size={40} style={{ color: C.dim, marginBottom: 16 }} />
      <p style={{ fontSize: 16, fontWeight: 600, color: C.txt2, margin: 0 }}>
        Restaurante não encontrado
      </p>
      <p style={{ fontSize: 13, color: C.muted, margin: '8px 0 20px', textAlign: 'center' }}>
        O código &quot;{slug}&quot; não corresponde a nenhum restaurante cadastrado.
      </p>
      <a href="/auth/login" style={{ fontSize: 13, color: C.accentLight, textDecoration: 'none' }}>
        ← Voltar ao login
      </a>
    </div>
  )

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.pageBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: `2px solid ${C.border}`, borderTopColor: C.accentLight, animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (step === 'dashboard') {
    const dateStr = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

    return (
      <div style={{ minHeight: '100vh', background: C.pageBg, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          background: C.surface, borderBottom: `1px solid ${C.border}`,
          padding: '14px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Package size={20} style={{ color: C.accentLight }} />
            <span style={{ fontSize: 16, fontWeight: 600, color: C.txt }}>{tenant?.name ?? slug}</span>
            <span style={{ fontSize: 13, color: C.muted }}>/ Estoque</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={13} style={{ color: C.subtle }} />
              <span style={{ fontSize: 13, color: C.subtle }}>{timeStr}</span>
            </div>
            <span style={{ fontSize: 13, color: C.txt2, fontWeight: 500 }}>{loggedUser?.name}</span>
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

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 24px' }}>
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 12, padding: '20px 24px',
            width: '100%', maxWidth: 560, marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 16,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: C.accentBg, border: `2px solid ${C.accent}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: C.accentLight }}>
                {loggedUser?.name?.[0]?.toUpperCase() ?? '?'}
              </span>
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 600, color: C.txt, margin: 0 }}>
                Olá, {loggedUser?.name}!
              </p>
              <p style={{ fontSize: 12, color: C.muted, margin: '2px 0 0', textTransform: 'capitalize' }}>
                {dateStr}
              </p>
            </div>
          </div>

          <div style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 12, width: '100%', maxWidth: 560, overflow: 'hidden',
          }}>
            <div style={{
              padding: '12px 20px', background: C.surface2,
              borderBottom: `1px solid ${C.border}`,
            }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                MOVIMENTAÇÕES RECENTES
              </span>
            </div>
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <Package size={40} style={{ color: C.dim, marginBottom: 12 }} />
              <p style={{ fontSize: 14, color: C.subtle, margin: 0 }}>
                Sem movimentações recentes
              </p>
              <p style={{ fontSize: 12, color: C.muted, margin: '4px 0 0' }}>
                As entradas e saídas aparecerão aqui
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.pageBg,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <div style={{
          margin: '0 auto 12px', width: 56, height: 56, borderRadius: 16,
          background: C.accentBg, border: `1px solid ${C.accent}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Package size={26} style={{ color: C.accentLight }} />
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: C.txt, margin: 0 }}>
          {tenant?.name ?? slug}
        </h1>
        <p style={{ fontSize: 13, color: C.muted, margin: '4px 0 0' }}>Painel do Estoque</p>
      </div>

      {step === 'select' && (
        <div style={{ width: '100%', maxWidth: 340 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 14 }}>
            <p style={{ fontSize: 13, color: C.subtle, margin: 0 }}>Selecione seu nome</p>
            <button
              onClick={loadPage}
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
              <Package size={32} style={{ color: C.dim, marginBottom: 10 }} />
              <p style={{ fontSize: 13, color: C.dim, margin: 0 }}>Nenhum estoquista com PIN configurado</p>
              <p style={{ fontSize: 12, color: C.muted, margin: '6px 0 0' }}>
                Um administrador deve cadastrar estoquistas com PIN
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
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.surface2; e.currentTarget.style.borderColor = C.accent }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = C.surface; e.currentTarget.style.borderColor = C.border }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: C.accentBg, border: `1px solid ${C.accent}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.accentLight }}>
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

      {step === 'pin' && (
        <div style={{ width: '100%', maxWidth: 280 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{
              margin: '0 auto 10px', width: 48, height: 48, borderRadius: '50%',
              background: C.accentBg, border: `2px solid ${C.accent}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: C.accentLight }}>
                {(selected?.name ?? '?')[0].toUpperCase()}
              </span>
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: C.txt, margin: 0 }}>{selected?.name}</p>
            <p style={{ fontSize: 12, color: C.muted, margin: '2px 0 0' }}>Digite seu PIN</p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 20 }}>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  width: 14, height: 14, borderRadius: '50%',
                  background: i < pin.length ? C.accentLight : C.surface2,
                  border: `2px solid ${i < pin.length ? C.accent : C.border}`,
                  transition: 'background 0.12s, border-color 0.12s',
                }}
              />
            ))}
          </div>

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
