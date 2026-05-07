import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'

export async function GET() {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1)

  try {
    const [
      totalTenants,
      activeSubs,
      trialSubs,
      suspendedSubs,
      newThisMonth,
      cancelledThisMonth,
      mrrData,
      planDistribution,
      monthlySignups,
    ] = await Promise.all([
      prisma.tenant.count({ where: { deletedAt: null } }),

      prisma.tenantSubscription.count({ where: { status: 'ACTIVE' } }),
      prisma.tenantSubscription.count({ where: { status: 'TRIAL' } }),
      prisma.tenantSubscription.count({ where: { status: 'SUSPENDED' } }),

      prisma.tenant.count({
        where: { deletedAt: null, createdAt: { gte: thirtyDaysAgo } },
      }),

      prisma.tenantSubscription.count({
        where: { status: 'CANCELLED', updatedAt: { gte: startOfMonth } },
      }),

      // MRR per month for the last 12 months (from paid invoices)
      prisma.invoice.groupBy({
        by: ['createdAt'],
        where: { status: 'PAID', createdAt: { gte: twelveMonthsAgo } },
        _sum: { amount: true },
      }),

      // Tenants per plan
      prisma.tenantSubscription.groupBy({
        by: ['planId'],
        where: { status: { in: ['ACTIVE', 'TRIAL'] } },
        _count: true,
      }),

      // Signups per month
      prisma.tenant.groupBy({
        by: ['createdAt'],
        where: { deletedAt: null, createdAt: { gte: twelveMonthsAgo } },
        _count: true,
      }),
    ])

    // MRR = sum of active subscriptions' contracted price
    const mrrResult = await prisma.tenantSubscription.aggregate({
      where: { status: 'ACTIVE' },
      _sum: { contractedPrice: true },
    })
    const mrr = mrrResult._sum.contractedPrice ?? 0

    // Enrich plan distribution with plan names
    const plans = await prisma.plan.findMany({ select: { id: true, name: true } })
    const planMap = Object.fromEntries(plans.map((p) => [p.id, p.name]))

    const enrichedPlanDist = planDistribution.map((d) => ({
      planId: d.planId,
      planName: planMap[d.planId] ?? 'Desconhecido',
      count: d._count,
    }))

    // Aggregate MRR and signups into monthly buckets
    const mrrByMonth = aggregateByMonth(
      mrrData.map((d) => ({ date: d.createdAt, value: d._sum.amount ?? 0 }))
    )

    const signupsByMonth = aggregateByMonth(
      monthlySignups.map((d) => ({ date: d.createdAt, value: d._count }))
    )

    const conversionRate =
      trialSubs > 0 ? ((activeSubs / (activeSubs + trialSubs)) * 100).toFixed(1) : '0'

    return NextResponse.json({
      stats: {
        totalTenants,
        activeTenants: activeSubs,
        trialTenants: trialSubs,
        suspendedTenants: suspendedSubs,
        mrr,
        newThisMonth,
        cancelledThisMonth,
        conversionRate: Number(conversionRate),
      },
      charts: {
        mrr: mrrByMonth,
        planDistribution: enrichedPlanDist,
        signups: signupsByMonth,
      },
    })
  } catch (error) {
    console.error('[ADMIN DASHBOARD]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

type DataPoint = { date: Date; value: number }
type MonthBucket = { month: string; value: number }

function aggregateByMonth(data: DataPoint[]): MonthBucket[] {
  const buckets: Record<string, number> = {}
  for (const d of data) {
    const key = `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, '0')}`
    buckets[key] = (buckets[key] ?? 0) + d.value
  }
  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => ({ month, value }))
}
