'use client'

import React, { useState, useRef } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Loader2, ChefHat, AlertCircle, Package, ShoppingCart, KeyRound, UtensilsCrossed } from 'lucide-react'
import { TFMark } from '@/components/ui/tf-mark'

const C = {
  pageBg:     '#0f1714',
  surface:    '#111a16',
  surface2:   '#0d1410',
  border:     '#1e2e26',
  txt:        '#e8f0ec',
  txt2:       '#c8dcd2',
  muted:      '#3d6050',
  dim:        '#2d5040',
  subtle:     '#5a7a6a',
  green:      '#2a9d6f',
  greenLight: '#4bc994',
  greenBg:    '#071a0f',
}

// ── Auth Left Panel ────────────────────────────────────────────────────────────

function FeatureItem({ text }: { text: string }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 10 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{
        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
        background: hovered ? C.greenLight : C.green,
        transition: 'background 0.15s',
      }} />
      <span style={{
        fontSize: 13,
        color: hovered ? C.subtle : C.muted,
        transition: 'color 0.15s',
      }}>
        {text}
      </span>
    </div>
  )
}

function AuthLeft() {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '48px 56px', position: 'relative', overflow: 'hidden',
      background: C.surface,
    }}>
      {/* Grid SVG decoration */}
      <svg aria-hidden="true" style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        opacity: 0.04, pointerEvents: 'none',
      }}>
        <defs>
          <pattern id="tf-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke={C.greenLight} strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#tf-grid)" />
      </svg>

      {/* Glow 1 */}
      <div aria-hidden="true" style={{
        position: 'absolute', top: -80, left: -80,
        width: 400, height: 400, borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(42,157,111,.18) 0%, transparent 70%)',
      }} />

      {/* Glow 2 */}
      <div aria-hidden="true" style={{
        position: 'absolute', bottom: 60, left: 120,
        width: 300, height: 300, borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(75,201,148,.08) 0%, transparent 70%)',
      }} />

      {/* Top section */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 56 }}>
          <TFMark size={55} main={C.greenLight} accent={C.green} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 18, fontWeight: 600, color: C.txt2, letterSpacing: '0.02em' }}>
              The Finance
            </span>
            <span style={{ fontSize: 10, fontWeight: 400, color: C.dim, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Restaurantes
            </span>
          </div>
        </div>

        {/* Tagline */}
        <div>
          <h1 style={{
            fontFamily: 'var(--tf-font-display)', fontSize: 52, fontWeight: 600,
            color: C.txt, lineHeight: 1.05, letterSpacing: '-0.5px',
            margin: '0 0 20px',
          }}>
            Sua operação sob <span style={{ color: C.greenLight }}>controle</span>,{' '}
            em tempo real.
          </h1>
          <p style={{
            fontFamily: 'var(--font-inter, var(--font-manrope))',
            fontSize: 14, fontWeight: 300, color: C.muted,
            maxWidth: 340, lineHeight: 1.7, margin: 0,
          }}>
            Estoque, cozinha e financeiro integrados para restaurantes que crescem.
          </p>
        </div>
      </div>

      {/* Bottom section — features + version */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          <FeatureItem text="Estoque com custo médio automático" />
          <FeatureItem text="Painel da cozinha em tempo real" />
          <FeatureItem text="Relatórios financeiros integrados" />
        </div>
        <span style={{ fontSize: 10, color: '#1e3028', letterSpacing: '0.04em' }}>
          v1.0.0
        </span>
      </div>
    </div>
  )
}

// ── Error parsing ─────────────────────────────────────────────────────────────

function parseError(error: string) {
  if (!error) return null
  if (error.includes('bloqueada') || error.includes('bloqueado')) {
    return { type: 'locked' as const, message: error }
  }
  const remaining = error.match(/(\d+) tentativa/)
  if (remaining) {
    return { type: 'invalid' as const, message: error, remaining: parseInt(remaining[1]) }
  }
  if (error === 'CredentialsSignin') {
    return { type: 'invalid' as const, message: 'Email ou senha incorretos.', remaining: null }
  }
  return { type: 'invalid' as const, message: error, remaining: null }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPin, setShowPin] = useState(false)
  const [pinRole, setPinRole] = useState<'cozinheiro' | 'estoquista' | 'caixa' | 'garcom' | null>(null)
  const [chefQuery, setChefQuery] = useState('')
  const [chefResults, setChefResults] = useState<{ name: string; slug: string }[]>([])
  const [chefSearching, setChefSearching] = useState(false)
  const chefTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleChefQuery(v: string) {
    setChefQuery(v)
    if (chefTimer.current) clearTimeout(chefTimer.current)
    chefTimer.current = setTimeout(async () => {
      if (v.trim().length < 2) { setChefResults([]); return }
      setChefSearching(true)
      try {
        const r = await fetch(`/api/cozinha/buscar?q=${encodeURIComponent(v)}`)
        const d = await r.json()
        setChefResults(Array.isArray(d) ? d : [])
      } finally {
        setChefSearching(false)
      }
    }, 350)
  }

  const parsedError = error ? parseError(error) : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await signIn('credentials', { email, password, redirect: false })
      if (result?.error) {
        setError(result.error)
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const inputBase: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: 7, fontSize: 13.5,
    background: C.surface2,
    border: `1px solid ${C.border}`,
    color: C.txt2, outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
  }

  return (
    <div style={{ background: C.pageBg, minHeight: '100vh' }}>
      <style>{`
        @media (min-width: 768px) {
          .auth-left  { display: flex !important; }
          .auth-logo  { display: none !important; }
        }
        @media (max-width: 767px) {
          .auth-right { width: 100% !important; border-left: none !important; }
          .auth-card  {
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            padding: 32px 0 !important;
            background: transparent !important;
          }
        }
        input::placeholder { color: ${C.dim}; }
        .login-forgot:hover { color: ${C.greenLight} !important; }
        .login-submit:hover:not(:disabled) {
          background: #207d58 !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 4px 20px rgba(42,157,111,.25) !important;
        }
        .login-submit:active:not(:disabled) { transform: translateY(0) !important; }
        .login-chef:hover {
          border-color: ${C.green} !important;
          color: ${C.greenLight} !important;
          background: ${C.greenBg} !important;
        }
      `}</style>

      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        {/* Left panel */}
        <div className="auth-left" style={{ display: 'none' }}>
          <AuthLeft />
        </div>

        {/* Right panel */}
        <div
          className="auth-right"
          style={{
            width: 480, background: C.pageBg,
            borderLeft: `1px solid ${C.border}`,
            display: 'flex', flexDirection: 'column',
            justifyContent: 'center', alignItems: 'center',
            padding: 32,
          }}
        >
          {/* Mobile logo */}
          <div className="auth-logo" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
            <TFMark size={22} main={C.greenLight} accent={C.green} />
            <span style={{ fontSize: 12, fontWeight: 600, color: C.subtle, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              THE FINANCE
            </span>
          </div>

          {/* Card */}
          <div
            className="auth-card"
            style={{
              width: '100%', maxWidth: 400,
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 12, padding: 40,
            }}
          >
            {/* Mini logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 22 }}>
              <TFMark size={54} main={C.greenLight} accent={C.green} />
              <span style={{ fontSize: 22, fontWeight: 600, color: C.subtle, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                THE FINANCE
              </span>
            </div>

            <h2 style={{
              fontSize: 22, fontWeight: 600, color: C.txt,
              letterSpacing: '-0.3px', margin: '0 0 6px',
            }}>
              Bem-vindo de volta
            </h2>
            <p style={{ fontSize: 13, color: C.dim, margin: `0 0 28px` }}>
              Entre com suas credenciais para continuar
            </p>

            {/* Error banner — locked */}
            {parsedError?.type === 'locked' && (
              <div style={{
                padding: '12px 16px', borderRadius: 8, marginBottom: 20,
                background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.25)',
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <AlertCircle size={16} style={{ color: '#f87171', flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ fontSize: 13, color: '#f87171', margin: '0 0 4px', fontWeight: 500 }}>
                    Conta temporariamente bloqueada.
                  </p>
                  <p style={{ fontSize: 13, color: '#f87171', margin: 0 }}>
                    {parsedError.message.replace('Conta bloqueada. ', '').replace('Conta bloqueada por 15 minutos após múltiplas tentativas.', 'Tente novamente em alguns minutos.')}{' '}
                    <Link href="/auth/recuperar-senha" style={{ color: '#f87171', textDecoration: 'underline' }}>
                      Redefinir senha →
                    </Link>
                  </p>
                </div>
              </div>
            )}

            {/* Error banner — invalid */}
            {parsedError?.type === 'invalid' && (
              <div style={{
                padding: '12px 16px', borderRadius: 8, marginBottom: 20,
                background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.25)',
                display: 'flex', gap: 10, alignItems: 'center',
              }}>
                <AlertCircle size={16} style={{ color: '#f87171', flexShrink: 0 }} />
                <p style={{ fontSize: 13, color: '#f87171', margin: 0 }}>
                  {parsedError.message}
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Email */}
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 500, color: C.subtle, marginBottom: 7 }}>
                  Email
                </label>
                <input
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com" style={inputBase}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = C.green
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(42,157,111,.12)'
                    e.currentTarget.style.background = C.pageBg
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = C.border
                    e.currentTarget.style.boxShadow = 'none'
                    e.currentTarget.style.background = C.surface2
                  }}
                />
              </div>

              {/* Senha */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                  <label style={{ fontSize: 11.5, fontWeight: 500, color: C.subtle }}>Senha</label>
                  <Link
                    href="/auth/recuperar-senha"
                    className="login-forgot"
                    style={{ fontSize: 12, color: C.green, textDecoration: 'none', transition: 'color 0.15s' }}
                  >
                    Esqueci minha senha →
                  </Link>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'} required value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••" style={{ ...inputBase, paddingRight: 40 }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = C.green
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(42,157,111,.12)'
                      e.currentTarget.style.background = C.pageBg
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = C.border
                      e.currentTarget.style.boxShadow = 'none'
                      e.currentTarget.style.background = C.surface2
                    }}
                  />
                  <button
                    type="button" onClick={() => setShowPassword((v) => !v)}
                    style={{
                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: C.dim,
                      padding: 4, display: 'flex', alignItems: 'center',
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = C.subtle }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = C.dim }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Attempts warning */}
              {parsedError?.remaining !== null && parsedError?.remaining !== undefined && parsedError.remaining <= 2 && (
                <p style={{ fontSize: 13, color: '#f59e0b', margin: '-4px 0', textAlign: 'center' }}>
                  {parsedError.remaining} tentativa{parsedError.remaining !== 1 ? 's' : ''} restante{parsedError.remaining !== 1 ? 's' : ''} antes do bloqueio
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="login-submit"
                style={{
                  width: '100%', padding: '13px', borderRadius: 7, border: 'none',
                  background: C.green, color: '#fff',
                  fontWeight: 600, fontSize: 14,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.75 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'background 0.15s, box-shadow 0.15s, transform 0.1s',
                  transform: 'translateY(0)',
                }}
              >
                {loading ? (<><Loader2 size={16} className="animate-spin" /> Entrando...</>) : 'Entrar'}
              </button>
            </form>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0' }}>
              <div style={{ flex: 1, height: 1, background: C.border }} />
              <span style={{ fontSize: 11, color: C.dim, fontWeight: 500 }}>ou</span>
              <div style={{ flex: 1, height: 1, background: C.border }} />
            </div>

            {/* Acesso por PIN */}
            <button
              type="button"
              className="login-chef"
              onClick={() => { setShowPin((v) => !v); setPinRole(null); setChefQuery(''); setChefResults([]) }}
              style={{
                width: '100%', padding: '12px', borderRadius: 7,
                background: showPin ? C.greenBg : 'transparent',
                border: `1px solid ${showPin ? C.green : C.border}`,
                color: showPin ? C.greenLight : C.subtle, cursor: 'pointer',
                fontWeight: 500, fontSize: 13,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'background 0.15s, border-color 0.15s, color 0.15s',
              }}
            >
              <KeyRound size={16} /> Acesso por PIN
            </button>

            {showPin && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Seleção de cargo */}
                <div style={{ display: 'flex', gap: 6 }}>
                  {([
                    { key: 'cozinheiro' as const, label: 'Cozinheiro', icon: ChefHat },
                    { key: 'estoquista' as const, label: 'Estoquista', icon: Package },
                    { key: 'caixa'      as const, label: 'Caixa',      icon: ShoppingCart },
                    { key: 'garcom'     as const, label: 'Garçom',     icon: UtensilsCrossed },
                  ]).map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => { setPinRole(key); setChefQuery(''); setChefResults([]) }}
                      style={{
                        flex: 1, padding: '8px 6px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                        background: pinRole === key ? C.greenBg : 'transparent',
                        border: `1px solid ${pinRole === key ? C.green : C.border}`,
                        color: pinRole === key ? C.greenLight : C.subtle,
                        cursor: 'pointer', transition: 'all 0.15s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      }}
                    >
                      <Icon size={13} /> {label}
                    </button>
                  ))}
                </div>

                {/* Busca (aparece só quando cargo selecionado) */}
                {pinRole && (
                  <div style={{ position: 'relative' }}>
                    <input
                      autoFocus
                      value={chefQuery}
                      onChange={(e) => handleChefQuery(e.target.value)}
                      placeholder="Nome do restaurante..."
                      style={{
                        width: '100%', padding: '10px 14px', borderRadius: 7, fontSize: 13,
                        background: C.surface2, border: `1px solid ${C.border}`,
                        color: C.txt2, outline: 'none', boxSizing: 'border-box',
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = C.green; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(42,157,111,.12)' }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = 'none' }}
                    />
                    {chefSearching && (
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: C.dim }}>
                        Buscando...
                      </span>
                    )}
                  </div>
                )}
                {chefResults.length > 0 && pinRole && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {chefResults.map((t) => {
                      const dest = pinRole === 'cozinheiro' ? 'cozinha' : pinRole
                      const Icon = pinRole === 'cozinheiro' ? ChefHat : pinRole === 'estoquista' ? Package : pinRole === 'garcom' ? UtensilsCrossed : ShoppingCart
                      return (
                        <button
                          key={t.slug}
                          type="button"
                          onClick={() => router.push(`/${t.slug}/${dest}`)}
                          style={{
                            width: '100%', padding: '10px 14px', borderRadius: 7,
                            background: C.surface2, border: `1px solid ${C.border}`,
                            color: C.txt2, cursor: 'pointer', textAlign: 'left', fontSize: 13,
                            display: 'flex', alignItems: 'center', gap: 8,
                          }}
                        >
                          <Icon size={14} style={{ color: C.greenLight, flexShrink: 0 }} />
                          {t.name}
                        </button>
                      )
                    })}
                  </div>
                )}
                {pinRole && chefQuery.trim().length >= 2 && !chefSearching && chefResults.length === 0 && (
                  <p style={{ fontSize: 12, color: C.dim, textAlign: 'center', margin: 0 }}>
                    Nenhum restaurante encontrado
                  </p>
                )}
              </div>
            )}

            <p style={{ textAlign: 'center', marginTop: 22, fontSize: 12, color: C.dim }}>
              Ainda não tem conta?{' '}
              <Link href="/auth/register" style={{ color: C.green, textDecoration: 'none', fontWeight: 500 }}>
                Solicitar acesso
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
