import { getAdminSession } from '@/lib/admin-auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { formatCurrency } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Link from 'next/link'

const statusLabel: Record<string, string> = {
  ACTIVE: 'Ativo', TRIAL: 'Trial', OVERDUE: 'Inadimplente',
  CANCELLED: 'Cancelado', SUSPENDED: 'Suspenso',
}
const invoiceStatusLabel: Record<string, string> = {
  PAID: 'Pago', PENDING: 'Pendente', OVERDUE: 'Atrasado',
}
const invoiceStatusColor: Record<string, string> = {
  PAID: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  PENDING: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  OVERDUE: 'bg-red-500/20 text-red-400 border-red-500/30',
}

export default async function TenantDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')

  const tenant = await prisma.tenant.findFirst({
    where: { id: params.id, deletedAt: null },
    include: {
      subscription: { include: { plan: true } },
      users: { select: { id: true, name: true, email: true, role: true, createdAt: true } },
      invoices: { include: { plan: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 12 },
      _count: { select: { products: true, ingredients: true, movements: true } },
    },
  })

  if (!tenant) notFound()

  const status = tenant.subscription?.status ?? 'TRIAL'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/admin/restaurantes" className="text-slate-400 hover:text-slate-200 text-sm transition-colors">← Restaurantes</Link>
        <span className="text-slate-600">/</span>
        <h1 className="text-2xl font-bold text-white">{tenant.name}</h1>
        <Badge variant="outline" className="text-xs">{statusLabel[status] ?? status}</Badge>
      </div>

      <Tabs defaultValue="geral">
        <TabsList className="bg-slate-900 border border-slate-800">
          <TabsTrigger value="geral" className="data-[state=active]:bg-indigo-600/20 data-[state=active]:text-indigo-400">Geral</TabsTrigger>
          <TabsTrigger value="uso" className="data-[state=active]:bg-indigo-600/20 data-[state=active]:text-indigo-400">Uso</TabsTrigger>
          <TabsTrigger value="financeiro" className="data-[state=active]:bg-indigo-600/20 data-[state=active]:text-indigo-400">Financeiro</TabsTrigger>
        </TabsList>

        {/* Aba Geral */}
        <TabsContent value="geral" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Dados Cadastrais</p>
              <Row label="Nome" value={tenant.name} />
              <Row label="Slug" value={tenant.slug} />
              <Row label="Telefone" value={tenant.phone ?? '—'} />
              <Row label="Cadastro" value={new Date(tenant.createdAt).toLocaleDateString('pt-BR')} />
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Assinatura</p>
              <Row label="Plano" value={tenant.subscription?.plan?.name ?? '—'} />
              <Row label="Status" value={statusLabel[status] ?? status} />
              <Row label="Valor Contratado" value={tenant.subscription ? formatCurrency(tenant.subscription.contractedPrice) + '/mês' : '—'} />
              <Row label="Vencimento" value={tenant.subscription ? new Date(tenant.subscription.expiresAt).toLocaleDateString('pt-BR') : '—'} />
            </div>
          </div>
        </TabsContent>

        {/* Aba Uso */}
        <TabsContent value="uso" className="space-y-4 mt-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Produtos cadastrados', value: tenant._count.products },
              { label: 'Insumos cadastrados', value: tenant._count.ingredients },
              { label: 'Movimentações', value: tenant._count.movements },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <p className="text-xs text-slate-400">{s.label}</p>
                <p className="mt-1 text-2xl font-bold text-white">{s.value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-400">Usuários do restaurante</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="pb-2">Nome</th>
                  <th className="pb-2">Email</th>
                  <th className="pb-2">Role</th>
                  <th className="pb-2">Desde</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {tenant.users.map((u) => (
                  <tr key={u.id} className="text-slate-300">
                    <td className="py-2">{u.name ?? '—'}</td>
                    <td className="py-2">{u.email}</td>
                    <td className="py-2"><Badge variant="outline" className="text-xs">{u.role}</Badge></td>
                    <td className="py-2 text-slate-500">{new Date(u.createdAt).toLocaleDateString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Aba Financeiro */}
        <TabsContent value="financeiro" className="space-y-4 mt-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/80 text-slate-400">
                <tr>
                  {['Data', 'Plano', 'Valor', 'Vencimento', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {tenant.invoices.map((inv) => (
                  <tr key={inv.id} className="bg-[#0a0d14] hover:bg-slate-800/40">
                    <td className="px-4 py-2 text-slate-400">{new Date(inv.createdAt).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-2 text-slate-300">{inv.plan.name}</td>
                    <td className="px-4 py-2 text-white font-medium">{formatCurrency(inv.amount)}</td>
                    <td className="px-4 py-2 text-slate-400">{new Date(inv.dueDate).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-2">
                      <Badge variant="outline" className={invoiceStatusColor[inv.status] ?? ''}>
                        {invoiceStatusLabel[inv.status] ?? inv.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tenant.invoices.length === 0 && (
              <p className="py-8 text-center text-slate-500 text-sm">Nenhuma fatura registrada.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200 font-medium">{value}</span>
    </div>
  )
}
