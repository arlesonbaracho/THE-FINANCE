import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const getInviteSchema = z.object({
  token: z.string().min(10),
})

const acceptSchema = z.object({
  name: z.string().min(2).max(80),
  password: z.string().min(8).regex(/[A-Z]/, 'Precisa de maiúscula').regex(/[0-9]/, 'Precisa de número'),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!getInviteSchema.safeParse({ token }).success) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 400 })
  }

  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { tenant: { select: { name: true, logo: true } } },
  })
  if (!invite) return NextResponse.json({ error: 'Convite não encontrado' }, { status: 404 })
  if (invite.status !== 'PENDING') return NextResponse.json({ error: 'Convite já utilizado ou expirado' }, { status: 410 })
  if (invite.expiresAt < new Date()) {
    await prisma.invite.update({ where: { token }, data: { status: 'EXPIRED' } })
    return NextResponse.json({ error: 'Convite expirado' }, { status: 410 })
  }

  return NextResponse.json({
    email: invite.email,
    tenantName: invite.tenant.name,
    tenantLogo: invite.tenant.logo,
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { tenant: true },
  })
  if (!invite) return NextResponse.json({ error: 'Convite não encontrado' }, { status: 404 })
  if (invite.status !== 'PENDING') return NextResponse.json({ error: 'Convite já utilizado' }, { status: 410 })
  if (invite.expiresAt < new Date()) {
    await prisma.invite.update({ where: { token }, data: { status: 'EXPIRED' } })
    return NextResponse.json({ error: 'Convite expirado' }, { status: 410 })
  }

  const body = await req.json()
  const parsed = acceptSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  // Check if email already registered in this tenant
  const existing = await prisma.user.findFirst({
    where: { email: invite.email, tenantId: invite.tenantId },
  })
  if (existing) return NextResponse.json({ error: 'Email já cadastrado neste restaurante' }, { status: 409 })

  const hash = await bcrypt.hash(parsed.data.password, 12)

  await prisma.$transaction([
    prisma.user.create({
      data: {
        name: parsed.data.name,
        email: invite.email,
        password: hash,
        tenantId: invite.tenantId,
        customRoleId: invite.roleId,
        role: 'STAFF',
        status: 'ACTIVE',
      },
    }),
    prisma.invite.update({
      where: { token },
      data: { status: 'ACCEPTED', usedAt: new Date() },
    }),
  ])

  return NextResponse.json({ ok: true })
}
