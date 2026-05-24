import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const schema = z.object({
  tenantSlug: z.string().min(1),
  userId: z.string().min(1),
  pin: z.string().length(4).regex(/^\d{4}$/),
})

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: 'Slug obrigatório' }, { status: 400 })

  const tenant = await prisma.tenant.findFirst({
    where: { OR: [{ slug }, { id: slug }] },
    select: { id: true, name: true },
  })
  if (!tenant) return NextResponse.json({ error: 'Restaurante não encontrado' }, { status: 404 })

  const users = await prisma.user.findMany({
    where: {
      tenantId: tenant.id,
      status: 'ACTIVE',
      pin: { not: null },
      customRole: { name: { contains: 'estoquista', mode: 'insensitive' } },
    },
    select: { id: true, name: true, avatarUrl: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({ tenant, users })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  const { tenantSlug, userId, pin } = parsed.data

  const tenant = await prisma.tenant.findFirst({ where: { OR: [{ slug: tenantSlug }, { id: tenantSlug }] } })
  if (!tenant) return NextResponse.json({ error: 'Restaurante não encontrado' }, { status: 404 })

  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId: tenant.id },
    include: { customRole: true },
  })

  if (!user) {
    console.error('[estoque/auth POST] user not found – userId:', userId, 'tenantId:', tenant.id)
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 401 })
  }
  if (user.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Usuário inativo' }, { status: 401 })
  }
  if (!user.pin) {
    return NextResponse.json({ error: 'PIN não configurado para este usuário' }, { status: 401 })
  }

  const valid = await bcrypt.compare(pin, user.pin)
  if (!valid) {
    console.error('[estoque/auth POST] wrong pin – userId:', userId)
    return NextResponse.json({ error: 'PIN incorreto' }, { status: 401 })
  }

  await prisma.user.update({ where: { id: user.id }, data: { ultimoAcesso: new Date() } })

  return NextResponse.json({
    id: user.id,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: user.role,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
  })
}
