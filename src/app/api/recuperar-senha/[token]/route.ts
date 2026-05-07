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
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Precisa de pelo menos 1 maiúscula')
    .regex(/[0-9]/, 'Precisa de pelo menos 1 número')
    .regex(/[^A-Za-z0-9]/, 'Precisa de pelo menos 1 caractere especial'),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } })
  if (!record) return NextResponse.json({ error: 'Token inválido' }, { status: 404 })
  if (record.usedAt) return NextResponse.json({ error: 'Token já utilizado' }, { status: 410 })
  if (record.expiresAt < new Date()) return NextResponse.json({ error: 'Token expirado' }, { status: 410 })

  return NextResponse.json({ valid: true })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const ip = getClientIp(req)

  // Rate limit: 5 tentativas inválidas/hora por IP
  const rl = rateLimit(`reset:use:${ip}`, { limit: 5, windowMs: 60 * 60 * 1000 })
  if (!rl.success) {
    return NextResponse.json({ error: 'Muitas tentativas. Tente novamente em 1 hora.' }, { status: 429 })
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, name: true, email: true } } },
  })

  if (!record) return NextResponse.json({ error: 'Token inválido ou expirado' }, { status: 404 })
  if (record.usedAt) return NextResponse.json({ error: 'Token já utilizado' }, { status: 410 })
  if (record.expiresAt < new Date()) return NextResponse.json({ error: 'Token expirado. Solicite um novo.' }, { status: 410 })

  const body = await req.json().catch(() => ({}))
  const parsed = resetSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const passwordHash = await bcrypt.hash(parsed.data.password, 12)
  const now = new Date()

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: {
        password: passwordHash,
        passwordChangedAt: now,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    }),
    prisma.passwordResetToken.update({
      where: { tokenHash },
      data: { usedAt: now },
    }),
  ])

  // Notificação por email (não-bloqueante)
  if (record.user.email) {
    emailService.sendPasswordChanged(
      record.user.email,
      ip,
      now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      record.user.name ?? undefined
    ).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
