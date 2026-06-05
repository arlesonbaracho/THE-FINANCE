import { getAdminSession } from '@/lib/admin-auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { formatCurrency } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { PlanActions } from '@/components/admin/plan-actions'
import { CreatePlanButton } from '@/components/admin/plan-form-modal'
import type { PlanData } from '@/components/admin/plan-form-modal'

const featureLabels: Record<string, string> = {
  aiAgent: 'Agente IA',
  advancedReports: 'Relatórios Avançados',
  multiUnit: 'Multi-unidade',
  prioritySupport: 'Suporte Prioritário',
  exportReports: 'Exportação',
}

export default async function PlanosPage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')

  const plans = await prisma.plan.findMany({
    include: { _count: { select: { subscriptions: true } } },
    orderBy: { monthlyPrice: 'asc' },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Planos ({plans.length})</h1>
        <CreatePlanButton />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => {
          const features = ((plan.features ?? {}) as PlanData['features'])
          const planData: PlanData = {
            id: plan.id,
            name: plan.name,
            description: plan.description,
            monthlyPrice: plan.monthlyPrice,
            annualPrice: plan.annualPrice,
            maxUsers: plan.maxUsers,
            maxProducts: plan.maxProducts,
            maxOrdersMonth: plan.maxOrdersMonth,
            features,
          }
          return (
            <div key={plan.id} className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-white">{plan.name}</p>
                  {plan.description && <p className="text-xs text-slate-400 mt-0.5">{plan.description}</p>}
                </div>
                <PlanActions plan={planData} subCount={plan._count.subscriptions} />
              </div>

              <div className="flex gap-4">
                <div>
                  <p className="text-xs text-slate-500">Mensal</p>
                  <p className="text-lg font-bold text-sky-400">{formatCurrency(plan.monthlyPrice)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Anual</p>
                  <p className="text-lg font-bold text-indigo-400">{formatCurrency(plan.annualPrice)}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs text-slate-400">
                <div><span className="text-white font-medium">{plan.maxUsers}</span> usuários</div>
                <div><span className="text-white font-medium">{plan.maxProducts}</span> produtos</div>
                <div><span className="text-white font-medium">{plan.maxOrdersMonth}k</span> pedidos/mês</div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {Object.entries(features ?? {}).map(([key, enabled]) => (
                  <Badge
                    key={key}
                    variant="outline"
                    className={enabled
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px]'
                      : 'border-slate-700 bg-slate-800 text-slate-600 text-[10px]'}
                  >
                    {featureLabels[key] ?? key}
                  </Badge>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-slate-800 pt-3">
                <p className="text-xs text-slate-500">
                  <span className="text-white font-medium">{plan._count.subscriptions}</span> assinatura(s)
                </p>
                <Badge variant="outline" className={plan.active ? 'text-emerald-400 border-emerald-500/30' : 'text-slate-500 border-slate-700'}>
                  {plan.active ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
