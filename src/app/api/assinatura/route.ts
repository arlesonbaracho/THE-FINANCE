import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorizedResponse } from '@/lib/session'
import { z } from 'zod'

const changeSchema = z.object({
  planId: z.string().min(1),
  billingCycle: z.enum(['MONTHLY', 'ANNUAL']).default('MONTHLY'),
  reason: z.string().max(500).optional(),
})

export async function GET() {
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  const tenantId = session.user.tenantId

  try {
    const [subscription, plans, history, cancellation] = await Promise.all([
      prisma.tenantSubscription.findUnique({
        where: { tenantId },
        include: { plan: true },
      }),
      prisma.plan.findMany({
        where: { active: true },
        orderBy: { monthlyPrice: 'asc' },
      }),
      prisma.planHistory.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.cancellationRequest.findUnique({ where: { tenantId } }),
    ])

    return NextResponse.json({ subscription, plans, history, cancellation })
  } catch (error) {
    console.error('[ASSINATURA GET]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  if (!['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Apenas administradores podem alterar o plano' }, { status: 403 })
  }
  const tenantId = session.user.tenantId

  try {
    const body = await req.json()
    const parsed = changeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
    }

    const { planId, billingCycle, reason } = parsed.data

    const [newPlan, subscription] = await Promise.all([
      prisma.plan.findFirst({ where: { id: planId, active: true } }),
      prisma.tenantSubscription.findUnique({ where: { tenantId }, include: { plan: true } }),
    ])

    if (!newPlan) return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 })
    if (!subscription) return NextResponse.json({ error: 'Assinatura não encontrada' }, { status: 404 })

    const oldPrice = subscription.contractedPrice
    const newPrice = billingCycle === 'ANNUAL' ? newPlan.annualPrice / 12 : newPlan.monthlyPrice
    const isUpgrade = newPrice > oldPrice

    if (isUpgrade) {
      // Upgrade: immediate effect
      const expiresAt = billingCycle === 'ANNUAL'
        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

      await prisma.$transaction([
        prisma.tenantSubscription.update({
          where: { tenantId },
          data: {
            planId,
            status: 'ACTIVE',
            contractedPrice: newPrice,
            expiresAt,
          },
        }),
        prisma.planHistory.create({
          data: {
            tenantId,
            fromPlanId: subscription.planId,
            toPlanId: planId,
            fromStatus: subscription.status,
            toStatus: 'ACTIVE',
            action: 'UPGRADE',
            reason: reason ?? null,
          },
        }),
      ])

      return NextResponse.json({ message: 'Plano atualizado com sucesso', action: 'UPGRADE' })
    } else {
      // Downgrade: scheduled for end of current period
      await prisma.planHistory.create({
        data: {
          tenantId,
          fromPlanId: subscription.planId,
          toPlanId: planId,
          fromStatus: subscription.status,
          toStatus: subscription.status,
          action: 'DOWNGRADE',
          reason: reason ?? null,
          scheduledFor: subscription.expiresAt,
        },
      })

      return NextResponse.json({
        message: `Downgrade agendado para ${subscription.expiresAt.toLocaleDateString('pt-BR')}`,
        action: 'DOWNGRADE',
        scheduledFor: subscription.expiresAt,
      })
    }
  } catch (error) {
    console.error('[ASSINATURA POST]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
