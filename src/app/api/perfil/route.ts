import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { emailService } from '@/lib/email/email.service'
import { getClientIp } from '@/lib/rate-limit'

const updateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  avatarUrl: z.string().optional().nullable(),
})

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Precisa de pelo menos 1 maiúscula')
    .regex(/[0-9]/, 'Precisa de pelo menos 1 número')
    .regex(/[^A-Za-z0-9]/, 'Precisa de pelo menos 1 caractere especial'),
  confirmPassword: z.string(),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      role: true,
      status: true,
      ultimoAcesso: true,
      createdAt: true,
      customRole: { select: { id: true, name: true, permissions: true } },
      accessLogs: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, ip: true, userAgent: true, action: true, createdAt: true },
      },
    },
  })

  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(user)
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: parsed.data,
    select: { id: true, name: true, email: true, avatarUrl: true },
  })
  return NextResponse.json(user)
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = passwordSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  if (parsed.data.newPassword !== parsed.data.confirmPassword) {
    return NextResponse.json({ error: 'As senhas não coincidem' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true, email: true, name: true },
  })
  if (!user?.password) return NextResponse.json({ error: 'Usuário sem senha' }, { status: 400 })

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.password)
  if (!valid) return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 })

  const hash = await bcrypt.hash(parsed.data.newPassword, 12)
  const now = new Date()

  await prisma.user.update({
    where: { id: session.user.id },
    data: { password: hash, passwordChangedAt: now },
  })

  // Notificação por email (não-bloqueante)
  if (user.email) {
    const ip = getClientIp(req)
    emailService.sendPasswordChanged(
      user.email,
      ip,
      now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      user.name ?? undefined
    ).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
