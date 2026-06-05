import { getAdminSession } from '@/lib/admin-auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Suspense } from 'react'
import { formatCurrency } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { TenantsActions } from '@/components/admin/tenants-actions'
import { RestaurantesFilters } from '@/components/admin/restaurantes-filters'

const statusLabel: Record<string, string> = {
  ACTIVE: 'Ativo', TRIAL: 'Trial', OVERDUE: 'Inadimplente',
  CANCELLED: 'Cancelado', SUSPENDED: 'Suspenso',
}
const statusColor: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  TRIAL: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  OVERDUE: 'bg-red-500/20 text-red-400 border-red-500/30',
  CANCELLED: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  SUSPENDED: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
}

interface PageProps {
  searchParams: { search?: string; status?: string; planId?: string }
}

export default async function TenantsPage({ searchParams }: PageProps) {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')

  const { search, status, planId } = searchParams

  const [tenants, plans] = await Promise.all([
    prisma.tenant.findMany({
      where: {
        deletedAt: null,
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { users: { some: { email: { contains: search, mode: 'insensitive' } } } },
          ],
        }),
        ...(status && { subscription: { status: status as never } }),
        ...(planId && { subscription: { planId } }),
      },
      include: {
        subscription: { include: { plan: true } },
        users: { where: { role: 'ADMIN' }, take: 1, select: { name: true, email: true } },
        _count: { select: { products: true, ingredients: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.plan.findMany({ select: { id: true, name: true }, orderBy: { monthlyPrice: 'asc' } }),
  ])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-white">
          Restaurantes
          <span className="ml-2 text-base font-normal text-slate-400">({tenants.length})</span>
        </h1>
        <Suspense>
          <RestaurantesFilters plans={plans} />
        </Suspense>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/80 text-slate-400">
            <tr>
              {['Restaurante', 'Responsável', 'Plano', 'Status', 'Cadastro', 'Ações'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {tenants.map((t) => {
              const sub = t.subscription
              const subStatus = sub?.status ?? 'TRIAL'
              const admin = t.users[0]
              return (
                <tr key={t.id} className="bg-[#0a0d14] hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/restaurantes/${t.id}`}
                      className="font-medium text-white hover:text-sky-400 transition-colors"
                    >
                      {t.name}
                    </Link>
                    <p className="text-xs text-slate-500">{t.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    <p>{admin?.name ?? '—'}</p>
                    <p className="text-xs text-slate-500">{admin?.email ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {sub?.plan?.name ?? '—'}
                    {sub && (
                      <p className="text-xs text-slate-500">{formatCurrency(sub.contractedPrice)}/mês</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={statusColor[subStatus] ?? ''}>
                      {statusLabel[subStatus] ?? subStatus}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {new Date(t.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    <TenantsActions tenantId={t.id} tenantName={t.name} status={subStatus} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {tenants.length === 0 && (
          <p className="py-10 text-center text-slate-500">
            {search || status || planId ? 'Nenhum restaurante encontrado para este filtro.' : 'Nenhum restaurante cadastrado.'}
          </p>
        )}
      </div>
    </div>
  )
}
