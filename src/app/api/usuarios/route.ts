import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { checkPermission, PERMISSIONS } from '@/lib/permissions'
import { emailService } from '@/lib/email/email.service'
import crypto from 'crypto'

const inviteEmailSchema = z.object({
  email: z.string().email(),
  roleId: z.string().cuid().optional(),
})

const invitePinSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  pin: z.string().length(4).regex(/^\d{4}$/, 'PIN deve ter exatamente 4 dígitos'),
  confirmPin: z.string().length(4),
  roleId: z.string().cuid().optional(),
}).refine((d) => d.pin === d.confirmPin, { message: 'PINs não coincidem', path: ['confirmPin'] })

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.user.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const allowed = await checkPermission(session.user.id, session.user.tenantId, PERMISSIONS.USUARIOS_VER)
  if (!allowed) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const tenantId = session.user.tenantId

  const [users, invites, roles] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true, name: true, email: true, role: true, status: true,
        ultimoAcesso: true, avatarUrl: true, pin: true, createdAt: true,
        customRole: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.invite.findMany({
      where: { tenantId, status: 'PENDING', expiresAt: { gt: new Date() } },
      select: { id: true, email: true, createdAt: true, roleId: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.role.findMany({
      where: { tenantId },
      select: { id: true, name: true },
    }),
  ])

  const roleMap = new Map(roles.map((r) => [r.id, r]))

  const userList = users.map(({ pin, ...u }) => ({ ...u, hasPin: !!pin, type: 'user' }))

  const inviteList = invites.map((inv) => ({
    id: `invite:${inv.id}`,
    name: null,
    email: inv.email,
    role: 'STAFF',
    status: 'PENDING' as const,
    ultimoAcesso: null,
    avatarUrl: null,
    hasPin: false,
    createdAt: inv.createdAt.toISOString(),
    customRole: inv.roleId ? (roleMap.get(inv.roleId) ?? null) : null,
    type: 'invite',
  }))

  return NextResponse.json([...userList, ...inviteList])
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.user.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const allowed = await checkPermission(session.user.id, session.user.tenantId, PERMISSIONS.USUARIOS_GERENCIAR)
  if (!allowed) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json()

  // Check plan limit
  const subscription = await prisma.tenantSubscription.findUnique({
    where: { tenantId: session.user.tenantId },
    include: { plan: true },
  })
  const currentCount = await prisma.user.count({
    where: { tenantId: session.user.tenantId, status: { not: 'INACTIVE' } },
  })
  if (subscription && currentCount >= subscription.plan.maxUsers) {
    return NextResponse.json(
      { error: `Limite de ${subscription.plan.maxUsers} usuários atingido no seu plano` },
      { status: 422 }
    )
  }

  // PIN-based creation (cozinheiro)
  if (body.pin !== undefined) {
    const parsed = invitePinSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
    }
    const { nome, pin, roleId } = parsed.data
    const pinHash = await bcrypt.hash(pin, 12)

    const user = await prisma.user.create({
      data: {
        name: nome,
        pin: pinHash,
        role: 'STAFF',
        status: 'ACTIVE',
        tenantId: session.user.tenantId,
        customRoleId: roleId ?? null,
      },
      select: { id: true, name: true },
    })

    return NextResponse.json({ ok: true, user }, { status: 201 })
  }

  // Email invite
  const parsed = inviteEmailSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  const existing = await prisma.invite.findUnique({
    where: { email_tenantId: { email: parsed.data.email, tenantId: session.user.tenantId } },
  })
  if (existing && existing.status === 'PENDING' && existing.expiresAt > new Date()) {
    return NextResponse.json({ error: 'Convite já enviado para este email' }, { status: 409 })
  }

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

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { name: true },
  })

  const inviteUrl = `${process.env.NEXTAUTH_URL}/auth/convite/${invite.token}`

  emailService
    .sendWelcomeInvite(parsed.data.email, inviteUrl, tenant?.name ?? 'THE FINANCE', 'Funcionário')
    .catch((e) => console.error('[EMAIL] Welcome invite failed:', e))

  return NextResponse.json({ ok: true, inviteUrl }, { status: 201 })
}
