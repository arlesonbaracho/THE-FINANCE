'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Loader2, AlertCircle, ArrowLeft } from 'lucide-react'
import { TFMark } from '@/components/ui/tf-mark'
import { AuthLeft, C } from '@/components/auth/auth-left'
import { toast } from 'sonner'

export default function RegisterPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    restaurantName: '',
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }

    if (formData.password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantName: formData.restaurantName,
          name: formData.name,
          email: formData.email,
          password: formData.password,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao criar conta.')
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

            <h2 style={{
              fontSize: 22, fontWeight: 600, color: C.txt,
              letterSpacing: '-0.3px', margin: '0 0 6px',
            }}>
              Criar conta
            </h2>
            <p style={{ fontSize: 13, color: C.dim, margin: `0 0 28px` }}>
              Preencha os dados do seu restaurante para começar
            </p>

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

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Nome do restaurante */}
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 500, color: C.subtle, marginBottom: 7 }}>
                  Nome do Restaurante
                </label>
                <input
                  name="restaurantName" required
                  value={formData.restaurantName} onChange={handleChange}
                  placeholder="Ex: Restaurante Sabor da Casa"
                  style={inputBase}
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

              {/* Seu nome */}
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 500, color: C.subtle, marginBottom: 7 }}>
                  Seu Nome
                </label>
                <input
                  name="name" required
                  value={formData.name} onChange={handleChange}
                  placeholder="Ex: João Silva"
                  style={inputBase}
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

              {/* Email */}
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 500, color: C.subtle, marginBottom: 7 }}>
                  Email
                </label>
                <input
                  type="email" name="email" required
                  value={formData.email} onChange={handleChange}
                  placeholder="seu@email.com"
                  style={inputBase}
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
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 500, color: C.subtle, marginBottom: 7 }}>
                  Senha
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password" required
                    value={formData.password} onChange={handleChange}
                    placeholder="Mínimo 6 caracteres"
                    style={{ ...inputBase, paddingRight: 40 }}
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

              {/* Confirmar senha */}
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 500, color: C.subtle, marginBottom: 7 }}>
                  Confirmar Senha
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    name="confirmPassword" required
                    value={formData.confirmPassword} onChange={handleChange}
                    placeholder="Repita a senha"
                    style={{ ...inputBase, paddingRight: 40 }}
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
                    type="button" onClick={() => setShowConfirm((v) => !v)}
                    style={{
                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: C.dim,
                      padding: 4, display: 'flex', alignItems: 'center',
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = C.subtle }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = C.dim }}
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="reg-submit"
                style={{
                  width: '100%', padding: '13px', borderRadius: 7, border: 'none',
                  background: C.green, color: '#fff',
                  fontWeight: 600, fontSize: 14,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.75 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'background 0.15s, box-shadow 0.15s, transform 0.1s',
                  transform: 'translateY(0)',
                  marginTop: 4,
                }}
              >
                {loading ? (<><Loader2 size={16} className="animate-spin" /> Criando conta...</>) : 'Criar Conta'}
              </button>
            </form>

            <p style={{ textAlign: 'center', marginTop: 22, fontSize: 12, color: C.dim }}>
              Já tem conta?{' '}
              <Link href="/auth/login" style={{ color: C.green, textDecoration: 'none', fontWeight: 500 }}>
                Fazer login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
