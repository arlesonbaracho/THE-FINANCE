import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'
import { logAdminAction } from '@/lib/admin-logger'
import { getClientIp } from '@/lib/rate-limit'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  phone: z.string().max(20).trim().optional(),
  planId: z.string().cuid().optional(),
})

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const tenant = await prisma.tenant.findFirst({
      where: { id: params.id, deletedAt: null },
      include: {
        subscription: { include: { plan: true } },
        users: { select: { id: true, name: true, email: true, role: true, createdAt: true } },
        invoices: {
          include: { plan: true },
          orderBy: { createdAt: 'desc' },
          take: 12,
        },
        _count: { select: { products: true, ingredients: true, movements: true } },
      },
    })

    if (!tenant) return NextResponse.json({ error: 'Restaurante não encontrado' }, { status: 404 })
    return NextResponse.json(tenant)
  } catch (error) {
    console.error('[ADMIN TENANT GET]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
    }

    const { name, phone, planId } = parsed.data

    const tenant = await prisma.tenant.findFirst({ where: { id: params.id, deletedAt: null } })
    if (!tenant) return NextResponse.json({ error: 'Restaurante não encontrado' }, { status: 404 })

    if (planId) {
      const plan = await prisma.plan.findUnique({ where: { id: planId } })
      if (!plan) return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 })

      const [updated] = await prisma.$transaction([
        prisma.tenant.update({
          where: { id: params.id },
          data: {
            ...(name && { name }),
            ...(phone !== undefined && { phone }),
          },
        }),
        prisma.tenantSubscription.upsert({
          where: { tenantId: params.id },
          update: { planId, contractedPrice: plan.monthlyPrice },
          create: {
            tenantId: params.id,
            planId,
            contractedPrice: plan.monthlyPrice,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        }),
      ])

      await logAdminAction({
        adminId: session.sub,
        action: 'UPDATE_TENANT',
        details: { tenantId: params.id, changes: parsed.data },
        ip: getClientIp(req),
      })

      return NextResponse.json(updated)
    }

    const updated = await prisma.tenant.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(phone !== undefined && { phone }),
      },
    })

    await logAdminAction({
      adminId: session.sub,
      action: 'UPDATE_TENANT',
      details: { tenantId: params.id, changes: parsed.data },
      ip: getClientIp(req),
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[ADMIN TENANT PUT]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const tenant = await prisma.tenant.findFirst({ where: { id: params.id, deletedAt: null } })
    if (!tenant) return NextResponse.json({ error: 'Restaurante não encontrado' }, { status: 404 })

    await prisma.tenant.update({
      where: { id: params.id },
      data: { deletedAt: new Date(), active: false },
    })

    await logAdminAction({
      adminId: session.sub,
      action: 'DELETE_TENANT',
      details: { tenantId: params.id, tenantName: tenant.name },
      ip: getClientIp(req),
    })

    return NextResponse.json({ message: 'Restaurante excluído' })
  } catch (error) {
    console.error('[ADMIN TENANT DELETE]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
