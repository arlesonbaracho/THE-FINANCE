import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'
import { logAdminAction } from '@/lib/admin-logger'
import { getClientIp } from '@/lib/rate-limit'
import { z } from 'zod'

const planSchema = z.object({
  name: z.string().min(2).max(80).trim(),
  description: z.string().max(300).trim().optional(),
  monthlyPrice: z.number().min(0).max(99_999),
  annualPrice: z.number().min(0).max(99_999),
  maxUsers: z.number().int().min(1).max(9_999),
  maxProducts: z.number().int().min(1).max(99_999),
  maxOrdersMonth: z.number().int().min(1).max(999_999),
  features: z.object({
    aiAgent: z.boolean(),
    advancedReports: z.boolean(),
    multiUnit: z.boolean(),
    prioritySupport: z.boolean(),
    exportReports: z.boolean(),
  }),
})

export async function GET() {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const plans = await prisma.plan.findMany({
      include: { _count: { select: { subscriptions: true } } },
      orderBy: { monthlyPrice: 'asc' },
    })
    return NextResponse.json(plans)
  } catch (error) {
    console.error('[ADMIN PLANS GET]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const body = await req.json()
    const parsed = planSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
    }

    const plan = await prisma.plan.create({ data: parsed.data })

    await logAdminAction({
      adminId: session.sub,
      action: 'CREATE_PLAN',
      details: { planId: plan.id, planName: plan.name },
      ip: getClientIp(req),
    })

    return NextResponse.json(plan, { status: 201 })
  } catch (error) {
    console.error('[ADMIN PLANS POST]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
