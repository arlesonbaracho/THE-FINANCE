import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'

export async function GET() {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const now = new Date()
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
    const over5DaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)

    const [expiringSoon, overdueOld] = await Promise.all([
      prisma.tenantSubscription.findMany({
        where: {
          status: { in: ['ACTIVE', 'TRIAL'] },
          expiresAt: { lte: in3Days, gte: now },
        },
        include: { tenant: { select: { id: true, name: true } } },
        take: 50,
      }),
      prisma.tenantSubscription.findMany({
        where: {
          status: 'OVERDUE',
          updatedAt: { lte: over5DaysAgo },
        },
        include: { tenant: { select: { id: true, name: true } } },
        take: 50,
      }),
    ])

    const notifications = [
      ...expiringSoon.map((s) => ({
        type: 'EXPIRING_SOON' as const,
        tenantId: s.tenant.id,
        tenantName: s.tenant.name,
        message: `Assinatura de "${s.tenant.name}" vence em breve`,
        expiresAt: s.expiresAt,
      })),
      ...overdueOld.map((s) => ({
        type: 'OVERDUE' as const,
        tenantId: s.tenant.id,
        tenantName: s.tenant.name,
        message: `"${s.tenant.name}" está inadimplente há mais de 5 dias`,
        expiresAt: null,
      })),
    ]

    return NextResponse.json({ notifications, count: notifications.length })
  } catch (error) {
    console.error('[ADMIN NOTIFICATIONS]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
