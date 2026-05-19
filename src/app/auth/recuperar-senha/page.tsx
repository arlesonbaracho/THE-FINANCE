'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Mail, MailCheck, Loader2 } from 'lucide-react'
import { TFMark } from '@/components/ui/tf-mark'

// ── Auth Split Layout ──────────────────────────────────────────────────────────

function AuthLeft() {
  return (
    <div style={{
      background: 'linear-gradient(160deg, var(--tf-primary-dark) 0%, var(--tf-primary) 100%)',
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      padding: '48px 56px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: -80, right: -80, width: 320, height: 320, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -60, left: -40, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 360 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TFMark size={24} main="rgba(255,255,255,0.92)" accent="rgba(255,255,255,0.60)" />
          </div>
          <span style={{ fontFamily: 'var(--font-manrope)', fontWeight: 800, fontSize: 20, color: 'white' }}>THE FINANCE</span>
        </div>
        <h1 style={{ fontFamily: 'var(--tf-font-display)', fontSize: 36, lineHeight: 1.2, color: 'white', margin: '0 0 16px 0', fontWeight: 400 }}>
          Sua operação sob controle, em tempo real.
        </h1>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, margin: 0 }}>
          Estoque, cozinha e financeiro integrados para restaurantes que crescem.
        </p>
      </div>
      <p style={{ position: 'absolute', bottom: 24, left: 56, fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0 }}>© 2026 THE FINANCE</p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type State = 'form' | 'sent'

export default function RecuperarSenhaPage() {
  const [state, setState] = useState<State>('form')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(0)

  function startCooldown() {
    setCooldown(60)
    const iv = setInterval(() => {
      setCooldown((v) => {
        if (v <= 1) { clearInterval(iv); return 0 }
        return v - 1
      })
    }, 1000)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading || cooldown > 0) return
    setLoading(true); setError('')
    try {
      await fetch('/api/recuperar-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setState('sent')
      startCooldown()
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (cooldown > 0) return
    setLoading(true)
    try {
      await fetch('/api/recuperar-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      startCooldown()
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: 8, fontSize: 14,
    background: 'var(--tf-input-bg)', border: '1px solid var(--tf-border-color)',
    color: 'var(--tf-txt)', outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <style>{`
        @media (min-width: 768px) {
          .auth-grid { grid-template-columns: 45fr 55fr !important; }
          .auth-left  { display: flex !important; }
        }
      `}</style>
      <div className="auth-grid" style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr' }}>
        <div className="auth-left" style={{ display: 'none' }}><AuthLeft /></div>

        <div style={{
          background: 'var(--tf-content-bg)',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          padding: '48px 24px',
        }}>
          <div style={{ width: '100%', maxWidth: 380 }}>
            {state === 'form' ? (
              <>
                <h2 style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: 24, color: 'var(--tf-txt)', margin: '0 0 8px 0' }}>
                  Redefinir senha
                </h2>
                <p style={{ fontSize: 14, color: 'var(--tf-txt3)', margin: '0 0 32px 0', lineHeight: 1.5 }}>
                  Informe seu email para receber o link de redefinição.
                </p>

                {error && (
                  <div style={{ padding: '11px 14px', borderRadius: 8, marginBottom: 16, background: 'var(--tf-red-bg)', border: '1px solid var(--tf-red-bd)', color: 'var(--tf-red)', fontSize: 13 }}>
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--tf-txt2)', marginBottom: 6 }}>Email</label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--tf-txt3)', pointerEvents: 'none' }} />
                      <input
                        type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                        placeholder="seu@email.com" style={{ ...inputStyle, paddingLeft: 36 }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--tf-primary)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--tf-primary-bg)' }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--tf-border-color)'; e.currentTarget.style.boxShadow = 'none' }}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      width: '100%', padding: '12px', borderRadius: 8,
                      background: 'var(--tf-primary)', color: 'var(--tf-primary-txt)',
                      border: 'none', fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: 15,
                      cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.8 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}
                  >
                    {loading ? (<><Loader2 size={16} className="animate-spin" /> Enviando...</>) : 'Enviar link'}
                  </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: 20 }}>
                  <Link href="/auth/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--tf-txt3)', textDecoration: 'none' }}>
                    <ArrowLeft size={13} /> Voltar para login
                  </Link>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: 'var(--tf-primary-bg)', border: '1px solid var(--tf-green-ok-bd)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <MailCheck size={28} style={{ color: 'var(--tf-primary)' }} />
                </div>
                <div>
                  <h2 style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: 22, color: 'var(--tf-txt)', margin: '0 0 8px 0' }}>
                    Verifique seu email
                  </h2>
                  <p style={{ fontSize: 14, color: 'var(--tf-txt3)', margin: 0, lineHeight: 1.6 }}>
                    Se <strong style={{ color: 'var(--tf-txt2)' }}>{email}</strong> estiver cadastrado,
                    você receberá as instruções em até 5 minutos.
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--tf-txt3)', marginTop: 8 }}>
                    Não recebeu? Verifique a caixa de spam.
                  </p>
                </div>
                <button
                  onClick={handleResend}
                  disabled={cooldown > 0 || loading}
                  style={{
                    padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                    background: 'var(--tf-surface)', border: '1px solid var(--tf-border-color)',
                    color: cooldown > 0 ? 'var(--tf-txt3)' : 'var(--tf-primary)',
                    cursor: cooldown > 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  {cooldown > 0 ? `Reenviar em ${cooldown}s` : loading ? 'Enviando...' : 'Reenviar email'}
                </button>
                <Link href="/auth/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--tf-txt3)', textDecoration: 'none' }}>
                  <ArrowLeft size={13} /> Voltar para login
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
