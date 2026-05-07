import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { emailService } from '@/lib/email/email.service'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const resetSchema = z.object({
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'Precisa de maiúscula')
    .regex(/[0-9]/, 'Precisa de número')
    .regex(/[^A-Za-z0-9]/, 'Precisa de caractere especial'),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const record = await prisma.adminPasswordResetToken.findUnique({ where: { tokenHash } })
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Token inválido ou expirado' }, { status: 410 })
  }
  return NextResponse.json({ valid: true })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const ip = getClientIp(req)

  const rl = rateLimit(`admin:reset:use:${ip}`, { limit: 5, windowMs: 60 * 60 * 1000 })
  if (!rl.success) {
    return NextResponse.json({ error: 'Muitas tentativas.' }, { status: 429 })
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const record = await prisma.adminPasswordResetToken.findUnique({
    where: { tokenHash },
    include: { adminUser: { select: { id: true, email: true } } },
  })

  if (!record) return NextResponse.json({ error: 'Token inválido' }, { status: 404 })
  if (record.usedAt) return NextResponse.json({ error: 'Token já utilizado' }, { status: 410 })
  if (record.expiresAt < new Date()) return NextResponse.json({ error: 'Token expirado (15 min)' }, { status: 410 })

  const body = await req.json().catch(() => ({}))
  const parsed = resetSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const passwordHash = await bcrypt.hash(parsed.data.password, 12)
  const now = new Date()

  await prisma.$transaction([
    // Redefine senha e invalida 2FA — força nova configuração do TOTP
    prisma.adminUser.update({
      where: { id: record.adminUserId },
      data: {
        passwordHash,
        passwordChangedAt: now,
        failedLoginAttempts: 0,
        lockedUntil: null,
        totpEnabled: false,
        totpSecret: null,
        totpConfirmedAt: null,
      },
    }),
    prisma.adminPasswordResetToken.update({
      where: { tokenHash },
      data: { usedAt: now },
    }),
  ])

  emailService.sendPasswordChanged(
    record.adminUser.email,
    ip,
    now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    'Super Admin'
  ).catch(() => {})

  return NextResponse.json({ ok: true })
}
