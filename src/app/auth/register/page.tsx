'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Loader2, AlertCircle, ArrowLeft, Mail, RotateCcw } from 'lucide-react'
import { TFMark } from '@/components/ui/tf-mark'
import { AuthLeft, C } from '@/components/auth/auth-left'
import { toast } from 'sonner'

type Step = 'form' | 'verify'

const RESEND_COOLDOWN = 60 // seconds

export default function RegisterPage() {
  const router = useRouter()

  // Step
  const [step, setStep] = useState<Step>('form')

  // Form data
  const [formData, setFormData] = useState({
    restaurantName: '',
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    aceiteLgpd: false,
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Verify step
  const [code, setCode] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const codeInputRef = useRef<HTMLInputElement>(null)

  // Shared
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Focus code input when step changes to verify
  useEffect(() => {
    if (step === 'verify') {
      setTimeout(() => codeInputRef.current?.focus(), 100)
    }
  }, [step])

  // Countdown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown((v) => v - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  // Step 1: send code
  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!formData.aceiteLgpd) {
      setError('É necessário aceitar a Política de Privacidade e os Termos.')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantName: formData.restaurantName,
          name: formData.name,
          email: formData.email,
          password: formData.password,
          aceiteLgpd: formData.aceiteLgpd,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 409) {
          setError('Este email já está cadastrado.')
        } else if (res.status === 429) {
          setError('Muitas tentativas. Tente novamente em alguns minutos.')
        } else {
          setError(data.error ?? 'Erro ao enviar código.')
        }
      } else {
        setStep('verify')
        setResendCooldown(RESEND_COOLDOWN)
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  // Step 2: verify code + create account
  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      setError('Digite o código de 6 dígitos enviado para seu email.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantName: formData.restaurantName,
          name: formData.name,
          email: formData.email,
          password: formData.password,
          aceiteLgpd: formData.aceiteLgpd,
          code,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Erro ao verificar código.')
      } else {
        toast.success('Conta criada com sucesso! Faça login para continuar.')
        router.push('/auth/login')
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  // Resend code
  async function handleResend() {
    if (resendCooldown > 0) return
    setError('')
    setCode('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantName: formData.restaurantName,
          name: formData.name,
          email: formData.email,
          password: formData.password,
          aceiteLgpd: formData.aceiteLgpd,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erro ao reenviar código.')
      } else {
        toast.success('Novo código enviado!')
        setResendCooldown(RESEND_COOLDOWN)
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

  const focusHandlers = {
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      e.currentTarget.style.borderColor = C.green
      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(42,157,111,.12)'
      e.currentTarget.style.background = C.pageBg
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      e.currentTarget.style.borderColor = C.border
      e.currentTarget.style.boxShadow = 'none'
      e.currentTarget.style.background = C.surface2
    },
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
        .reg-submit:hover:not(:disabled) {
          background: #207d58 !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 4px 20px rgba(42,157,111,.25) !important;
        }
        .reg-submit:active:not(:disabled) { transform: translateY(0) !important; }
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
            padding: 32, overflowY: 'auto',
          }}
        >
          {/* Mobile back button */}
          <div className="auth-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 400, marginBottom: 20 }}>
            <Link
              href="/"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 12, fontWeight: 500, color: C.muted,
                textDecoration: 'none', padding: '6px 10px',
                borderRadius: 6, border: `1px solid ${C.border}`,
              }}
            >
              <ArrowLeft size={13} /> Voltar
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TFMark size={22} main={C.greenLight} accent={C.green} />
              <span style={{ fontSize: 12, fontWeight: 600, color: C.subtle, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                THE FINANCE
              </span>
            </div>
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

            {/* Error banner */}
            {error && (
              <div style={{
                padding: '12px 16px', borderRadius: 8, marginBottom: 20,
                background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.25)',
                display: 'flex', gap: 10, alignItems: 'center',
              }}>
                <AlertCircle size={16} style={{ color: '#f87171', flexShrink: 0 }} />
                <p style={{ fontSize: 13, color: '#f87171', margin: 0 }}>{error}</p>
              </div>
            )}

            {/* ── STEP 1: FORM ── */}
            {step === 'form' && (
              <>
                <h2 style={{ fontSize: 22, fontWeight: 600, color: C.txt, letterSpacing: '-0.3px', margin: '0 0 6px' }}>
                  Criar conta
                </h2>
                <p style={{ fontSize: 13, color: C.dim, margin: '0 0 28px' }}>
                  Preencha os dados do seu restaurante para começar
                </p>

                <form onSubmit={handleSendCode} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 500, color: C.subtle, marginBottom: 7 }}>
                      Nome do Restaurante
                    </label>
                    <input name="restaurantName" required value={formData.restaurantName} onChange={handleChange} placeholder="Ex: Restaurante Sabor da Casa" style={inputBase} {...focusHandlers} />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 500, color: C.subtle, marginBottom: 7 }}>
                      Seu Nome
                    </label>
                    <input name="name" required value={formData.name} onChange={handleChange} placeholder="Ex: João Silva" style={inputBase} {...focusHandlers} />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 500, color: C.subtle, marginBottom: 7 }}>
                      Email
                    </label>
                    <input type="email" name="email" required value={formData.email} onChange={handleChange} placeholder="seu@email.com" style={inputBase} {...focusHandlers} />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 500, color: C.subtle, marginBottom: 7 }}>
                      Senha
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password" required value={formData.password} onChange={handleChange}
                        placeholder="Mínimo 8 caracteres, 1 maiúscula, 1 número"
                        style={{ ...inputBase, paddingRight: 40 }}
                        {...focusHandlers}
                      />
                      <button type="button" onClick={() => setShowPassword((v) => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.dim, padding: 4, display: 'flex', alignItems: 'center' }}>
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 500, color: C.subtle, marginBottom: 7 }}>
                      Confirmar Senha
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        name="confirmPassword" required value={formData.confirmPassword} onChange={handleChange}
                        placeholder="Repita a senha"
                        style={{ ...inputBase, paddingRight: 40 }}
                        {...focusHandlers}
                      />
                      <button type="button" onClick={() => setShowConfirm((v) => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.dim, padding: 4, display: 'flex', alignItems: 'center' }}>
                        {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <input
                      type="checkbox"
                      id="aceiteLgpd"
                      required
                      checked={formData.aceiteLgpd}
                      onChange={(e) => setFormData((prev) => ({ ...prev, aceiteLgpd: e.target.checked }))}
                      style={{ marginTop: 2, cursor: 'pointer', accentColor: C.green, flexShrink: 0 }}
                    />
                    <label htmlFor="aceiteLgpd" style={{ fontSize: 12, color: C.dim, cursor: 'pointer', lineHeight: 1.5 }}>
                      Li e aceito a{' '}
                      <a href="/privacidade" target="_blank" rel="noopener noreferrer" style={{ color: C.green, textDecoration: 'underline' }}>
                        Política de Privacidade
                      </a>{' '}
                      e os{' '}
                      <a href="/termos" target="_blank" rel="noopener noreferrer" style={{ color: C.green, textDecoration: 'underline' }}>
                        Termos
                      </a>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !formData.aceiteLgpd}
                    className="reg-submit"
                    style={{
                      width: '100%', padding: '13px', borderRadius: 7, border: 'none',
                      background: C.green, color: '#fff',
                      fontWeight: 600, fontSize: 14,
                      cursor: (loading || !formData.aceiteLgpd) ? 'not-allowed' : 'pointer',
                      opacity: (loading || !formData.aceiteLgpd) ? 0.75 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      transition: 'background 0.15s, box-shadow 0.15s, transform 0.1s',
                      marginTop: 4,
                    }}
                  >
                    {loading ? (<><Loader2 size={16} className="animate-spin" /> Enviando código...</>) : 'Continuar'}
                  </button>
                </form>

                <p style={{ textAlign: 'center', marginTop: 22, fontSize: 12, color: C.dim }}>
                  Já tem conta?{' '}
                  <Link href="/auth/login" style={{ color: C.green, textDecoration: 'none', fontWeight: 500 }}>
                    Fazer login
                  </Link>
                </p>
              </>
            )}

            {/* ── STEP 2: VERIFY ── */}
            {step === 'verify' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 10,
                    background: 'rgba(42,157,111,.12)',
                    border: '1px solid rgba(42,157,111,.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Mail size={20} color={C.green} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: 20, fontWeight: 600, color: C.txt, margin: '0 0 2px', letterSpacing: '-0.3px' }}>
                      Verifique seu email
                    </h2>
                    <p style={{ fontSize: 12, color: C.dim, margin: 0 }}>
                      Código enviado para <strong style={{ color: C.subtle }}>{formData.email}</strong>
                    </p>
                  </div>
                </div>

                <p style={{ fontSize: 13, color: C.dim, margin: '0 0 24px' }}>
                  Digite o código de <strong style={{ color: C.subtle }}>6 dígitos</strong> que enviamos para o seu email. Ele expira em 15 minutos.
                </p>

                <form onSubmit={handleVerifyCode} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 500, color: C.subtle, marginBottom: 7 }}>
                      Código de verificação
                    </label>
                    <input
                      ref={codeInputRef}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      style={{
                        ...inputBase,
                        fontSize: 28,
                        fontWeight: 700,
                        letterSpacing: '0.25em',
                        textAlign: 'center',
                        padding: '14px',
                      }}
                      {...focusHandlers}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || code.length !== 6}
                    className="reg-submit"
                    style={{
                      width: '100%', padding: '13px', borderRadius: 7, border: 'none',
                      background: C.green, color: '#fff',
                      fontWeight: 600, fontSize: 14,
                      cursor: (loading || code.length !== 6) ? 'not-allowed' : 'pointer',
                      opacity: (loading || code.length !== 6) ? 0.65 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      transition: 'background 0.15s, box-shadow 0.15s, transform 0.1s',
                    }}
                  >
                    {loading ? (<><Loader2 size={16} className="animate-spin" /> Verificando...</>) : 'Confirmar'}
                  </button>
                </form>

                {/* Resend + Back */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 }}>
                  <button
                    onClick={handleResend}
                    disabled={resendCooldown > 0 || loading}
                    style={{
                      background: 'none', border: 'none', cursor: resendCooldown > 0 ? 'default' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: 5,
                      fontSize: 12, color: resendCooldown > 0 ? C.dim : C.green,
                      padding: 0, transition: 'color 0.15s',
                    }}
                  >
                    <RotateCcw size={12} />
                    {resendCooldown > 0 ? `Reenviar em ${resendCooldown}s` : 'Reenviar código'}
                  </button>

                  <button
                    onClick={() => { setStep('form'); setCode(''); setError('') }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 12, color: C.dim,
                      display: 'flex', alignItems: 'center', gap: 4, padding: 0,
                    }}
                  >
                    <ArrowLeft size={12} /> Voltar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
