import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorizedResponse } from '@/lib/session'
import { z } from 'zod'

const cancelSchema = z.object({
  reason: z.string().min(1, 'Motivo é obrigatório').max(500),
  feedback: z.string().max(1000).optional(),
  confirmation: z.string(),
})

export async function POST(req: Request) {
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  if (!['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Apenas administradores podem cancelar a assinatura' }, { status: 403 })
  }
  const tenantId = session.user.tenantId

  try {
    const body = await req.json()
    const parsed = cancelSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
    }

    const { reason, feedback, confirmation } = parsed.data

    if (confirmation !== 'CANCELAR') {
      return NextResponse.json({ error: 'Digite CANCELAR para confirmar' }, { status: 400 })
    }

    const subscription = await prisma.tenantSubscription.findUnique({
      where: { tenantId },
    })

    if (!subscription) {
      return NextResponse.json({ error: 'Assinatura não encontrada' }, { status: 404 })
    }

    if (subscription.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Assinatura já cancelada' }, { status: 400 })
    }

    // Schedule cancellation for 30 days from now (retention period)
    const scheduledAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    await prisma.$transaction([
      prisma.cancellationRequest.upsert({
        where: { tenantId },
        update: { reason, feedback: feedback ?? null, requestedAt: new Date(), scheduledAt, status: 'PENDING', processedAt: null },
        create: { tenantId, reason, feedback: feedback ?? null, scheduledAt, status: 'PENDING' },
      }),
      prisma.planHistory.create({
        data: {
          tenantId,
          fromPlanId: subscription.planId,
          toPlanId: subscription.planId,
          fromStatus: subscription.status,
          toStatus: 'CANCELLED',
          action: 'CANCEL',
          reason,
          scheduledFor: scheduledAt,
        },
      }),
    ])

    return NextResponse.json({
      message: 'Cancelamento agendado. Você terá acesso até ' + scheduledAt.toLocaleDateString('pt-BR'),
      scheduledAt,
    })
  } catch (error) {
    console.error('[ASSINATURA CANCELAR]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE() {
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  if (!['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  const tenantId = session.user.tenantId

  try {
    const cancellation = await prisma.cancellationRequest.findUnique({ where: { tenantId } })
    if (!cancellation || cancellation.status !== 'PENDING') {
      return NextResponse.json({ error: 'Nenhum cancelamento pendente encontrado' }, { status: 404 })
    }

    await prisma.$transaction([
      prisma.cancellationRequest.update({
        where: { tenantId },
        data: { status: 'REVERTED', processedAt: new Date() },
      }),
      prisma.planHistory.create({
        data: {
          tenantId,
          fromPlanId: (await prisma.tenantSubscription.findUnique({ where: { tenantId } }))!.planId,
          toPlanId: (await prisma.tenantSubscription.findUnique({ where: { tenantId } }))!.planId,
          fromStatus: 'CANCELLED',
          toStatus: 'ACTIVE',
          action: 'REACTIVATE',
          reason: 'Cancelamento revertido pelo usuário',
        },
      }),
    ])

    return NextResponse.json({ message: 'Cancelamento revertido com sucesso' })
  } catch (error) {
    console.error('[ASSINATURA CANCELAR DELETE]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
