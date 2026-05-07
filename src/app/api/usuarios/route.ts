import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { checkPermission, PERMISSIONS } from '@/lib/permissions'
import crypto from 'crypto'

const inviteSchema = z.object({
  email: z.string().email(),
  roleId: z.string().cuid().optional(),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.user.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const allowed = await checkPermission(session.user.id, session.user.tenantId, PERMISSIONS.USUARIOS_VER)
  if (!allowed) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const users = await prisma.user.findMany({
    where: { tenantId: session.user.tenantId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      ultimoAcesso: true,
      avatarUrl: true,
      createdAt: true,
      customRole: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.user.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const allowed = await checkPermission(session.user.id, session.user.tenantId, PERMISSIONS.USUARIOS_GERENCIAR)
  if (!allowed) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json()
  const parsed = inviteSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  // Check plan limit
  const subscription = await prisma.tenantSubscription.findUnique({
    where: { tenantId: session.user.tenantId },
    include: { plan: true },
  })
  const currentCount = await prisma.user.count({
    where: { tenantId: session.user.tenantId, status: { not: 'INACTIVE' } },
  })
  if (subscription && currentCount >= subscription.plan.maxUsers) {
    return NextResponse.json({ error: `Limite de ${subscription.plan.maxUsers} usuários atingido no seu plano` }, { status: 422 })
  }

  // Check if invite already exists
  const existing = await prisma.invite.findUnique({
    where: { email_tenantId: { email: parsed.data.email, tenantId: session.user.tenantId } },
  })
  if (existing && existing.status === 'PENDING' && existing.expiresAt > new Date()) {
    return NextResponse.json({ error: 'Convite já enviado para este email' }, { status: 409 })
  }

  // Check if user already in tenant
  const existingUser = await prisma.user.findFirst({
    where: { email: parsed.data.email, tenantId: session.user.tenantId },
  })
  if (existingUser) return NextResponse.json({ error: 'Usuário já faz parte deste restaurante' }, { status: 409 })

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000)

  const invite = await prisma.invite.upsert({
    where: { email_tenantId: { email: parsed.data.email, tenantId: session.user.tenantId } },
    create: {
      email: parsed.data.email,
      tenantId: session.user.tenantId,
      roleId: parsed.data.roleId,
      token,
      expiresAt,
      invitedBy: session.user.id,
    },
    update: {
      token,
      expiresAt,
      status: 'PENDING',
      roleId: parsed.data.roleId,
    },
  })

  const inviteUrl = `${process.env.NEXTAUTH_URL}/convite/${invite.token}`
  return NextResponse.json({ ok: true, inviteUrl }, { status: 201 })
}
