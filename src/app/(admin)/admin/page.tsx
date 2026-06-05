import { getAdminSession } from '@/lib/admin-auth'
import { redirect } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { MrrChart } from '@/components/admin/mrr-chart'
import { PlanDistributionChart } from '@/components/admin/plan-distribution-chart'
import { SignupsChart } from '@/components/admin/signups-chart'
import { prisma } from '@/lib/prisma'

export default async function AdminDashboardPage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1)

  const [
    totalTenants,
    activeSubs,
    trialSubs,
    suspendedSubs,
    newThisMonth,
    cancelledThisMonth,
    mrrResult,
    planDistribution,
    monthlySignups,
    paidInvoices,
  ] = await Promise.all([
    prisma.tenant.count({ where: { deletedAt: null } }),
    prisma.tenantSubscription.count({ where: { status: 'ACTIVE' } }),
    prisma.tenantSubscription.count({ where: { status: 'TRIAL' } }),
    prisma.tenantSubscription.count({ where: { status: 'SUSPENDED' } }),
    prisma.tenant.count({ where: { deletedAt: null, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.tenantSubscription.count({ where: { status: 'CANCELLED', updatedAt: { gte: startOfMonth } } }),
    prisma.tenantSubscription.aggregate({ where: { status: 'ACTIVE' }, _sum: { contractedPrice: true } }),
    prisma.tenantSubscription.groupBy({
      by: ['planId'],
      where: { status: { in: ['ACTIVE', 'TRIAL'] } },
      _count: true,
    }),
    prisma.tenant.groupBy({
      by: ['createdAt'],
      where: { deletedAt: null, createdAt: { gte: twelveMonthsAgo } },
      _count: true,
    }),
    prisma.invoice.groupBy({
      by: ['createdAt'],
      where: { status: 'PAID', createdAt: { gte: twelveMonthsAgo } },
      _sum: { amount: true },
    }),
  ])

  const mrr = mrrResult._sum.contractedPrice ?? 0
  const conversionRate = trialSubs > 0 ? ((activeSubs / (activeSubs + trialSubs)) * 100).toFixed(1) : '0'

  const plans = await prisma.plan.findMany({ select: { id: true, name: true } })
  const planMap = Object.fromEntries(plans.map((p) => [p.id, p.name]))

  const enrichedPlanDist = planDistribution.map((d) => ({
    planName: planMap[d.planId] ?? 'Desconhecido',
    count: d._count,
  }))

  function aggregateByMonth(data: Array<{ date: Date; value: number }>) {
    const buckets: Record<string, number> = {}
    for (const d of data) {
      const key = `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, '0')}`
      buckets[key] = (buckets[key] ?? 0) + d.value
    }
    return Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b)).map(([month, value]) => ({ month, value }))
  }

  const mrrByMonth = aggregateByMonth(paidInvoices.map((d) => ({ date: d.createdAt, value: d._sum.amount ?? 0 })))
  const signupsByMonth = aggregateByMonth(monthlySignups.map((d) => ({ date: d.createdAt, value: d._count })))

  const stats = [
    { label: 'Total de Restaurantes', value: totalTenants, color: 'text-slate-100' },
    { label: 'Ativos', value: activeSubs, color: 'text-emerald-400' },
    { label: 'Em Trial', value: trialSubs, color: 'text-amber-400' },
    { label: 'Suspensos', value: suspendedSubs, color: 'text-red-400' },
    { label: 'MRR', value: formatCurrency(mrr), color: 'text-sky-400' },
    { label: 'Novos (30 dias)', value: newThisMonth, color: 'text-indigo-400' },
    { label: 'Churns (mês)', value: cancelledThisMonth, color: 'text-rose-400' },
    { label: 'Conversão Trial→Pago', value: `${conversionRate}%`, color: 'text-teal-400' },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Dashboard</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs text-slate-400">{s.label}</p>
            <p className={`mt-1 text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="col-span-2 rounded-xl border border-slate-800 bg-slate-900 p-5">
          <p className="mb-3 text-sm font-medium text-slate-300">MRR — últimos 12 meses</p>
          <MrrChart data={mrrByMonth} />
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <p className="mb-3 text-sm font-medium text-slate-300">Distribuição por plano</p>
          <PlanDistributionChart data={enrichedPlanDist} />
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <p className="mb-3 text-sm font-medium text-slate-300">Novos cadastros por mês</p>
        <SignupsChart data={signupsByMonth} />
      </div>
    </div>
  )
}
