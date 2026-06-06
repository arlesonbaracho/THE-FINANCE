# Email Verification on Registration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a two-step email verification flow to registration: user submits the form → receives a 6-digit code by email → enters the code → account is created.

**Architecture:** New `EmailVerificationCode` Prisma model stores codes with TTL. Two new API routes (`send-code`, `verify-code`) replace the current single `register` route for the frontend. The register page gets a `step` state to toggle between the form and a code-entry screen. All email sending uses the existing `emailService` in `src/lib/email/email.service.ts`.

**Tech Stack:** Next.js 15 App Router, Prisma (PostgreSQL), React Email + Resend/Nodemailer, Zod, bcryptjs, Vitest

---

## File Map

| File | Action |
|------|--------|
| `prisma/schema.prisma` | MODIFY — add `EmailVerificationCode` model |
| `src/lib/verification-code.ts` | CREATE — `generateVerificationCode()` helper |
| `src/lib/__tests__/verification-code.test.ts` | CREATE — unit tests for code generator |
| `src/lib/email/templates/email-verification.tsx` | CREATE — React Email template |
| `src/lib/email/email.service.ts` | MODIFY — add `sendEmailVerification` method |
| `src/app/api/auth/register/send-code/route.ts` | CREATE — validate + generate + send code |
| `src/app/api/auth/register/verify-code/route.ts` | CREATE — verify code + create account |
| `src/app/auth/register/page.tsx` | MODIFY — add step state + verification screen |

---

## Task 1: Prisma — Add EmailVerificationCode model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add model to schema**

Open `prisma/schema.prisma` and add this block anywhere after the existing models (e.g., after the `VerificationToken` model):

```prisma
model EmailVerificationCode {
  id        String    @id @default(cuid())
  email     String
  code      String
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([email])
}
```

- [ ] **Step 2: Run migration**

```bash
cd C:\Users\gemes\Desktop\THE-FINANCE
npx prisma migrate dev --name add-email-verification-code
```

Expected output contains:
```
✔ Generated Prisma Client
The following migration(s) have been created and applied
```

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add EmailVerificationCode model"
```

---

## Task 2: Code Generator Helper + Tests

**Files:**
- Create: `src/lib/verification-code.ts`
- Create: `src/lib/__tests__/verification-code.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/verification-code.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { generateVerificationCode } from '@/lib/verification-code'

describe('generateVerificationCode', () => {
  it('returns a string of exactly 6 characters', () => {
    const code = generateVerificationCode()
    expect(typeof code).toBe('string')
    expect(code).toHaveLength(6)
  })

  it('contains only digits', () => {
    const code = generateVerificationCode()
    expect(/^\d{6}$/.test(code)).toBe(true)
  })

  it('is always at least 100000', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateVerificationCode()
      expect(parseInt(code, 10)).toBeGreaterThanOrEqual(100000)
    }
  })

  it('is always at most 999999', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateVerificationCode()
      expect(parseInt(code, 10)).toBeLessThanOrEqual(999999)
    }
  })

  it('generates different codes across calls', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateVerificationCode()))
    // With 20 random 6-digit codes, collision probability is negligible
    expect(codes.size).toBeGreaterThan(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:\Users\gemes\Desktop\THE-FINANCE
npx vitest run src/lib/__tests__/verification-code.test.ts
```

Expected: FAIL — "Cannot find module '@/lib/verification-code'"

- [ ] **Step 3: Create the implementation**

Create `src/lib/verification-code.ts`:

```ts
/**
 * Generates a cryptographically-simple 6-digit numeric verification code.
 * Range: 100000–999999 (always exactly 6 digits, no leading zeros).
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/__tests__/verification-code.test.ts
```

Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/verification-code.ts src/lib/__tests__/verification-code.test.ts
git commit -m "feat(lib): add generateVerificationCode helper with tests"
```

---

## Task 3: Email Verification Template + Service Method

**Files:**
- Create: `src/lib/email/templates/email-verification.tsx`
- Modify: `src/lib/email/email.service.ts`

- [ ] **Step 1: Create the email template**

Create `src/lib/email/templates/email-verification.tsx`:

```tsx
import { Heading, Text } from '@react-email/components'
import { BaseLayout } from './base-layout'

interface EmailVerificationProps {
  code: string
  name?: string
  expiresInMinutes: number
}

export function EmailVerificationEmail({ code, name, expiresInMinutes }: EmailVerificationProps) {
  return (
    <BaseLayout preview={`Seu código de verificação: ${code}`}>
      <Heading style={h1}>Confirme seu email</Heading>
      <Text style={text}>
        {name ? `Olá, ${name}` : 'Olá'}! Para concluir o cadastro no THE FINANCE, use o código abaixo.
      </Text>
      <Text style={text}>
        Digite este código na tela de verificação:
      </Text>

      <div style={codeBox}>
        <Text style={codeText}>{code}</Text>
      </div>

      <Text style={expiry}>
        Este código expira em <strong style={{ color: '#f4f4f5' }}>{expiresInMinutes} minutos</strong>.
      </Text>

      <Text style={warning}>
        Se você não tentou criar uma conta no THE FINANCE, ignore este email. Nenhuma ação é necessária.
      </Text>
    </BaseLayout>
  )
}

const h1: React.CSSProperties = {
  color: '#f4f4f5',
  fontSize: '22px',
  fontWeight: '700',
  margin: '0 0 16px',
}

const text: React.CSSProperties = {
  color: '#a1a1aa',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0 0 16px',
}

const codeBox: React.CSSProperties = {
  backgroundColor: '#09090b',
  border: '1px solid #3f3f46',
  borderRadius: '8px',
  margin: '8px 0 24px',
  padding: '20px',
  textAlign: 'center',
}

const codeText: React.CSSProperties = {
  color: '#f4f4f5',
  fontSize: '36px',
  fontWeight: '700',
  letterSpacing: '0.3em',
  margin: '0',
  fontFamily: 'monospace',
}

const expiry: React.CSSProperties = {
  color: '#a1a1aa',
  fontSize: '13px',
  margin: '0 0 20px',
}

const warning: React.CSSProperties = {
  backgroundColor: '#27272a',
  borderLeft: '3px solid #f97316',
  borderRadius: '4px',
  color: '#a1a1aa',
  fontSize: '12px',
  lineHeight: '18px',
  margin: '0',
  padding: '12px 16px',
}
```

- [ ] **Step 2: Add `sendEmailVerification` to email service**

Open `src/lib/email/email.service.ts`. Add the import at the top (with the other template imports):

```ts
import { EmailVerificationEmail } from './templates/email-verification'
```

Then add this method to the `emailService` object, after `sendAdminPasswordReset`:

```ts
  async sendEmailVerification(to: string, code: string, userName?: string): Promise<void> {
    const html = await render(EmailVerificationEmail({ code, name: userName, expiresInMinutes: 15 }))
    await send(to, 'Confirme seu email — THE FINANCE', html)
  },
```

- [ ] **Step 3: Check TypeScript**

```bash
cd C:\Users\gemes\Desktop\THE-FINANCE
npx tsc --noEmit 2>&1 | grep -v node_modules | head -20
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/email/templates/email-verification.tsx src/lib/email/email.service.ts
git commit -m "feat(email): add EmailVerificationEmail template and sendEmailVerification method"
```

---

## Task 4: send-code API Route

**Files:**
- Create: `src/app/api/auth/register/send-code/route.ts`

- [ ] **Step 1: Create the route file**

Create `src/app/api/auth/register/send-code/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { registerSchema, zodErrorResponse } from '@/lib/validations'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { emailService } from '@/lib/email/email.service'
import { generateVerificationCode } from '@/lib/verification-code'

export async function POST(req: Request) {
  const ip = getClientIp(req)
  const rl = rateLimit(`register-send-code:${ip}`, { limit: 3, windowMs: 60 * 60 * 1000 })
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    )
  }

  try {
    const body = await req.json()
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(zodErrorResponse(parsed.error), { status: 400 })
    }

    const { email, name } = parsed.data

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json(
        { error: 'Este email já está cadastrado.' },
        { status: 409 }
      )
    }

    const code = generateVerificationCode()
    await prisma.emailVerificationCode.create({
      data: {
        email,
        code,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    })

    // Fire-and-forget — email failure should not block the response
    emailService.sendEmailVerification(email, code, name).catch((err) => {
      console.error('[SEND-CODE] Email send failed:', err instanceof Error ? err.message : 'unknown')
    })

    return NextResponse.json({ message: 'Código enviado' })
  } catch (error) {
    console.error('[SEND-CODE]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Check TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -v node_modules | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/auth/register/send-code/route.ts"
git commit -m "feat(api): add POST /api/auth/register/send-code"
```

---

## Task 5: verify-code API Route

**Files:**
- Create: `src/app/api/auth/register/verify-code/route.ts`

- [ ] **Step 1: Create the route file**

Create `src/app/api/auth/register/verify-code/route.ts`:

```ts
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { registerSchema, zodErrorResponse } from '@/lib/validations'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { slugify } from '@/lib/utils'
import { z } from 'zod'

const verifySchema = registerSchema.extend({
  code: z.string().length(6).regex(/^\d{6}$/, 'Código deve ter 6 dígitos numéricos'),
})

export async function POST(req: Request) {
  const ip = getClientIp(req)

  try {
    const body = await req.json()
    const parsed = verifySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(zodErrorResponse(parsed.error), { status: 400 })
    }

    const { email, code, restaurantName, name, password } = parsed.data

    // Rate limit per email (brute-force protection)
    const rl = rateLimit(`register-verify:${email}`, { limit: 10, windowMs: 60 * 60 * 1000 })
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
      )
    }

    // Find latest valid, unused code for this email
    const record = await prisma.emailVerificationCode.findFirst({
      where: { email, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    })

    if (!record) {
      return NextResponse.json(
        { error: 'Código inválido ou expirado.' },
        { status: 400 }
      )
    }

    if (record.code !== code) {
      return NextResponse.json(
        { error: 'Código incorreto.' },
        { status: 400 }
      )
    }

    // Mark code as used immediately to prevent replay
    await prisma.emailVerificationCode.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    })

    // Race condition guard: re-check email uniqueness
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json(
        { error: 'Este email já está cadastrado.' },
        { status: 409 }
      )
    }

    let slug = slugify(restaurantName)
    const existingSlug = await prisma.tenant.findUnique({ where: { slug } })
    if (existingSlug) slug = `${slug}-${Date.now()}`

    const hashedPassword = await bcrypt.hash(password, 12)

    const tenant = await prisma.tenant.create({
      data: {
        name: restaurantName,
        slug,
        users: {
          create: {
            name,
            email,
            password: hashedPassword,
            role: 'ADMIN',
            emailVerified: new Date(),
          },
        },
      },
    })

    return NextResponse.json(
      { message: 'Conta criada com sucesso', tenantId: tenant.id },
      { status: 201 }
    )
  } catch (error) {
    console.error('[VERIFY-CODE]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Check TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -v node_modules | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/auth/register/verify-code/route.ts"
git commit -m "feat(api): add POST /api/auth/register/verify-code"
```

---

## Task 6: Update Register Page — Two-Step Flow

**Files:**
- Modify: `src/app/auth/register/page.tsx`

This is a full replacement. Read the file first, then write the new content.

- [ ] **Step 1: Replace the register page**

Write this content to `src/app/auth/register/page.tsx`:

```tsx
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
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Erro ao enviar código.')
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
```

- [ ] **Step 2: Check TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -v node_modules | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add "src/app/auth/register/page.tsx"
git commit -m "feat(register): two-step email verification flow"
```

---

## Task 7: Run Full Test Suite + Final Check

- [ ] **Step 1: Run all tests**

```bash
cd C:\Users\gemes\Desktop\THE-FINANCE
npx vitest run 2>&1 | tail -10
```

Expected:
```
Test Files  25 passed (25)
     Tests  333 passed (333)
```
(328 existing + 5 new verification-code tests)

- [ ] **Step 2: TypeScript full check**

```bash
npx tsc --noEmit 2>&1 | grep -v node_modules
```

Expected: empty output (no errors)

- [ ] **Step 3: Manual smoke test**

Start the dev server:
```bash
npm run dev:next
```

Navigate to `http://localhost:3001/auth/register` and verify:
1. Form has 5 fields (restaurant name, name, email, password, confirm password)
2. Submit shows "Enviando código..." spinner
3. If email already exists → error "Este email já está cadastrado."
4. On success → page transitions to verification screen showing the email address
5. Entering wrong code → error "Código incorreto."
6. Entering correct code → redirects to `/auth/login` with success toast
7. "Reenviar código" shows 60s countdown after click
8. "Voltar" returns to the form with original values preserved

Check dev console for email log if no SMTP configured:
```
📧 [EMAIL DEV] To: test@example.com
Subject: Confirme seu email — THE FINANCE
```

- [ ] **Step 4: Commit if any fixes needed**

```bash
git add -A
git commit -m "fix(register): post-smoke-test adjustments"
```
