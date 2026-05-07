import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'
import { logAdminAction } from '@/lib/admin-logger'
import { getClientIp } from '@/lib/rate-limit'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(2).max(80).trim().optional(),
  description: z.string().max(300).trim().optional(),
  monthlyPrice: z.number().min(0).max(99_999).optional(),
  annualPrice: z.number().min(0).max(99_999).optional(),
  maxUsers: z.number().int().min(1).optional(),
  maxProducts: z.number().int().min(1).optional(),
  maxOrdersMonth: z.number().int().min(1).optional(),
  features: z.object({
    aiAgent: z.boolean(),
    advancedReports: z.boolean(),
    multiUnit: z.boolean(),
    prioritySupport: z.boolean(),
    exportReports: z.boolean(),
  }).optional(),
  active: z.boolean().optional(),
})

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const plan = await prisma.plan.findUnique({
    where: { id: params.id },
    include: { _count: { select: { subscriptions: true } } },
  })
  if (!plan) return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 })
  return NextResponse.json(plan)
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
    }

    const plan = await prisma.plan.update({ where: { id: params.id }, data: parsed.data })

    await logAdminAction({
      adminId: session.sub,
      action: 'UPDATE_PLAN',
      details: { planId: params.id },
      ip: getClientIp(req),
    })

    return NextResponse.json(plan)
  } catch (error) {
    console.error('[ADMIN PLAN PUT]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const count = await prisma.tenantSubscription.count({ where: { planId: params.id } })
    if (count > 0) {
      return NextResponse.json(
        { error: `Este plano possui ${count} assinatura(s) ativa(s). Desative-o em vez de excluir.` },
        { status: 409 }
      )
    }

    await prisma.plan.delete({ where: { id: params.id } })

    await logAdminAction({
      adminId: session.sub,
      action: 'DELETE_PLAN',
      details: { planId: params.id },
      ip: getClientIp(req),
    })

    return NextResponse.json({ message: 'Plano excluído' })
  } catch (error) {
    console.error('[ADMIN PLAN DELETE]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
