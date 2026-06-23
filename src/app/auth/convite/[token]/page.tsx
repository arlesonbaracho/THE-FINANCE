'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { TFMark } from '@/components/ui/tf-mark'

// ── Auth Left Panel ────────────────────────────────────────────────────────────

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
          <div style={{ width: 64, height: 64, borderRadius: 14, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TFMark size={34} main="rgba(255,255,255,0.92)" accent="rgba(255,255,255,0.60)" />
          </div>
          <span style={{ fontFamily: 'var(--font-manrope)', fontWeight: 800, fontSize: 22, color: 'white' }}>THE FINANCE</span>
        </div>
        <h1 style={{ fontFamily: 'var(--tf-font-display)', fontSize: 36, lineHeight: 1.2, color: 'white', margin: '0 0 16px 0', fontWeight: 400 }}>
          Sua operação sob controle, em tempo real.
        </h1>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, margin: '0 0 32px 0' }}>
          Estoque, cozinha e financeiro integrados para restaurantes que crescem.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {['Estoque com custo médio automático', 'Painel da cozinha em tempo real', 'Relatórios financeiros integrados'].map((text) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <span style={{ fontSize: 14, color: 'white' }}>{text}</span>
            </div>
          ))}
        </div>
      </div>
      <p style={{ position: 'absolute', bottom: 24, left: 56, fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0 }}>© 2026 THE FINANCE</p>
    </div>
  )
}

// ── Strength indicator ────────────────────────────────────────────────────────

function getPwStrength(pw: string) {
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 2) return { score, label: 'Fraca', color: 'var(--tf-red)' }
  if (score <= 3) return { score, label: 'Média', color: 'var(--tf-yellow)' }
  return { score, label: 'Forte', color: 'var(--tf-green-ok)' }
}

// ── Page ──────────────────────────────────────────────────────────────────────

type InviteInfo = { valid: boolean; email: string; role: string; tenantName: string }
type PageState = 'loading' | 'invalid' | 'form' | 'success'

export default function ConvitePage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const [pageState, setPageState] = useState<PageState>('loading')
  const [invite, setInvite] = useState<InviteInfo | null>(null)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [aceiteLgpd, setAceiteLgpd] = useState(false)
  const pwStr = getPwStrength(password)

  useEffect(() => {
    if (!token) { setPageState('invalid'); return }
    fetch(`/api/convite/validate/${token}`)
      .then((r) => r.json())
      .then((d: InviteInfo) => {
        if (d.valid) { setInvite(d); setPageState('form') }
        else setPageState('invalid')
      })
      .catch(() => setPageState('invalid'))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('As senhas não coincidem'); return }
    if (pwStr.score < 3) { setError('Senha muito fraca. Use maiúsculas, números e caracteres especiais.'); return }
    if (!aceiteLgpd) { setError('É necessário aceitar a Política de Privacidade e os Termos'); return }
    setSubmitting(true); setError('')
    const res = await fetch(`/api/convite/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), password, aceiteLgpd: true }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) { setError(data.error ?? 'Erro ao aceitar convite'); return }
    setPageState('success')
    setTimeout(() => router.push('/auth/login'), 3000)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: 8, fontSize: 14,
    background: 'var(--tf-input-bg)', border: '1px solid var(--tf-border-color)',
    color: 'var(--tf-txt)', outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--tf-txt2)', marginBottom: 6,
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
          <div style={{ width: '100%', maxWidth: 400 }}>
            {pageState === 'loading' && (
              <p style={{ textAlign: 'center', color: 'var(--tf-txt3)', fontSize: 14 }}>Verificando convite...</p>
            )}

            {pageState === 'invalid' && (
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--tf-red-bg)', border: '1px solid var(--tf-red-bd)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <XCircle size={28} style={{ color: 'var(--tf-red)' }} />
                </div>
                <h2 style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: 20, color: 'var(--tf-txt)', margin: 0 }}>
                  Convite inválido ou expirado
                </h2>
                <p style={{ fontSize: 14, color: 'var(--tf-txt3)', margin: 0, lineHeight: 1.5 }}>
                  Este link não é mais válido. Solicite um novo convite ao administrador do sistema.
                </p>
                <Link
                  href="/auth/login"
                  style={{ padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'var(--tf-primary)', color: 'var(--tf-primary-txt)', textDecoration: 'none' }}
                >
                  Ir para login
                </Link>
              </div>
            )}

            {pageState === 'form' && invite && (
              <>
                {/* Welcome banner */}
                <div style={{
                  padding: '14px 16px', borderRadius: 10, marginBottom: 24,
                  background: 'var(--tf-primary-bg)', border: '1px solid var(--tf-green-ok-bd)',
                }}>
                  <p style={{ fontSize: 13, color: 'var(--tf-txt2)', margin: 0, lineHeight: 1.5 }}>
                    Você foi convidado para{' '}
                    <strong style={{ color: 'var(--tf-txt)' }}>{invite.tenantName}</strong>{' '}
                    como <strong style={{ color: 'var(--tf-txt)' }}>{invite.role}</strong>.
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--tf-txt3)', margin: '4px 0 0' }}>{invite.email}</p>
                </div>

                <h2 style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: 24, color: 'var(--tf-txt)', margin: '0 0 6px 0' }}>
                  Bem-vindo ao THE FINANCE!
                </h2>
                <p style={{ fontSize: 14, color: 'var(--tf-txt3)', margin: '0 0 28px 0' }}>
                  Crie sua senha para começar.
                </p>

                {error && (
                  <div style={{ padding: '11px 14px', borderRadius: 8, marginBottom: 16, background: 'var(--tf-red-bg)', border: '1px solid var(--tf-red-bd)', color: 'var(--tf-red)', fontSize: 13 }}>
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div>
                    <label style={labelStyle}>Nome completo</label>
                    <input
                      type="text" required value={name} onChange={(e) => setName(e.target.value)}
                      minLength={2} placeholder="Ex: João Silva" style={inputStyle}
                      onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--tf-primary)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--tf-primary-bg)' }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--tf-border-color)'; e.currentTarget.style.boxShadow = 'none' }}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Nova senha</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPw ? 'text' : 'password'} required value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 8 caracteres"
                        style={{ ...inputStyle, paddingRight: 44 }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--tf-primary)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--tf-primary-bg)' }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--tf-border-color)'; e.currentTarget.style.boxShadow = 'none' }}
                      />
                      <button type="button" onClick={() => setShowPw((v) => !v)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tf-txt3)', padding: 2 }}>
                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {password.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} style={{
                              height: 4, flex: 1, borderRadius: 2,
                              background: i <= pwStr.score ? pwStr.color : 'var(--tf-border-color)',
                              transition: 'background 0.2s',
                            }} />
                          ))}
                        </div>
                        <p style={{ fontSize: 12, color: pwStr.color, marginTop: 5, marginBottom: 0 }}>
                          {pwStr.label} — mín. 8 chars, 1 maiúscula, 1 número, 1 especial
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={labelStyle}>
                      Confirmar senha{' '}
                      {confirm.length > 0 && (
                        <span style={{ fontSize: 12, color: confirm === password ? 'var(--tf-green-ok)' : 'var(--tf-red)' }}>
                          {confirm === password ? '✓' : '✗'}
                        </span>
                      )}
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showConfirm ? 'text' : 'password'} required value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder="Repita a senha"
                        style={{
                          ...inputStyle, paddingRight: 44,
                          borderColor: confirm && confirm !== password ? 'var(--tf-red)' : 'var(--tf-border-color)',
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = confirm !== password ? 'var(--tf-red)' : 'var(--tf-primary)' }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = confirm && confirm !== password ? 'var(--tf-red)' : 'var(--tf-border-color)' }}
                      />
                      <button type="button" onClick={() => setShowConfirm((v) => !v)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tf-txt3)', padding: 2 }}>
                        {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {confirm && confirm !== password && (
                      <p style={{ fontSize: 12, color: 'var(--tf-red)', marginTop: 4, marginBottom: 0 }}>As senhas não coincidem</p>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <input
                      id="aceite-lgpd"
                      type="checkbox"
                      checked={aceiteLgpd}
                      onChange={(e) => setAceiteLgpd(e.target.checked)}
                      style={{ marginTop: 2, flexShrink: 0, accentColor: 'var(--tf-primary)', width: 16, height: 16, cursor: 'pointer' }}
                    />
                    <label htmlFor="aceite-lgpd" style={{ fontSize: 13, color: 'var(--tf-txt2)', lineHeight: 1.5, cursor: 'pointer' }}>
                      Li e aceito a{' '}
                      <a href="/privacidade" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--tf-primary)', textDecoration: 'underline' }}>
                        Política de Privacidade
                      </a>
                      {' '}e os{' '}
                      <a href="/termos" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--tf-primary)', textDecoration: 'underline' }}>
                        Termos de Uso
                      </a>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || password !== confirm || pwStr.score < 3 || !name.trim() || !aceiteLgpd}
                    style={{
                      width: '100%', padding: '12px', borderRadius: 8,
                      background: 'var(--tf-primary)', color: 'var(--tf-primary-txt)',
                      border: 'none', fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: 15,
                      cursor: submitting || password !== confirm || pwStr.score < 3 || !name.trim() || !aceiteLgpd ? 'not-allowed' : 'pointer',
                      opacity: submitting || password !== confirm || pwStr.score < 3 || !name.trim() || !aceiteLgpd ? 0.6 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      marginTop: 6,
                    }}
                  >
                    {submitting ? (<><Loader2 size={16} className="animate-spin" /> Criando conta...</>) : 'Criar minha conta'}
                  </button>
                </form>
              </>
            )}

            {pageState === 'success' && (
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--tf-primary-bg)', border: '1px solid var(--tf-green-ok-bd)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle2 size={28} style={{ color: 'var(--tf-primary)' }} />
                </div>
                <div>
                  <h2 style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: 22, color: 'var(--tf-txt)', margin: '0 0 8px 0' }}>
                    Conta criada!
                  </h2>
                  <p style={{ fontSize: 14, color: 'var(--tf-txt3)', margin: 0, lineHeight: 1.6 }}>
                    Seu acesso foi configurado com sucesso. Redirecionando para o login...
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
