import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { signAdminToken, setAdminCookie } from '@/lib/admin-auth'
import { verifyTotpToken } from '@/lib/totp'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1).max(128),
  totpToken: z.string().optional(),
})

const MAX_FAILED = 5
const LOCK_MS = 15 * 60 * 1000

export async function POST(req: Request) {
  const ip = getClientIp(req)
  const rl = rateLimit(`admin-login:${ip}`, { limit: 10, windowMs: 15 * 60 * 1000 })
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Aguarde alguns minutos.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    )
  }

  try {
    const body = await req.json()
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

    const { email, password, totpToken } = parsed.data

    const admin = await prisma.adminUser.findUnique({ where: { email } })

    const dummyHash = '$2a$12$dummyhashforadmintimingprotection.padpadp'
    const hashToCheck = admin?.passwordHash ?? dummyHash
    const valid = await bcrypt.compare(password, hashToCheck)

    // Check lockout after bcrypt (timing-safe)
    if (admin?.lockedUntil && admin.lockedUntil > new Date()) {
      const minutes = Math.ceil((admin.lockedUntil.getTime() - Date.now()) / 60000)
      return NextResponse.json(
        { error: `Conta bloqueada. Tente em ${minutes} minuto${minutes !== 1 ? 's' : ''}.` },
        { status: 423 }
      )
    }

    if (!admin || !valid) {
      if (admin) {
        const newCount = admin.failedLoginAttempts + 1
        const shouldLock = newCount >= MAX_FAILED
        await prisma.adminUser.update({
          where: { id: admin.id },
          data: {
            failedLoginAttempts: newCount,
            ...(shouldLock && { lockedUntil: new Date(Date.now() + LOCK_MS) }),
          },
        })
        if (shouldLock) {
          return NextResponse.json(
            { error: `Conta bloqueada por ${LOCK_MS / 60000} minutos após múltiplas tentativas.` },
            { status: 423 }
          )
        }
        const remaining = MAX_FAILED - newCount
        return NextResponse.json(
          { error: `Credenciais inválidas. ${remaining} tentativa${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''}.` },
          { status: 401 }
        )
      }
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
    }

    // Reset failed attempts on success
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    })

    if (!admin.totpEnabled || !admin.totpSecret) {
      return NextResponse.json({ requiresTotpSetup: true, adminId: admin.id })
    }

    if (!totpToken) {
      return NextResponse.json({ requiresTotp: true })
    }

    const totpValid = verifyTotpToken(totpToken, admin.totpSecret)
    if (!totpValid) {
      return NextResponse.json({ error: 'Código 2FA inválido ou expirado' }, { status: 401 })
    }

    const token = await signAdminToken({ sub: admin.id, email: admin.email, role: admin.role })
    setAdminCookie(token)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[ADMIN LOGIN]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
