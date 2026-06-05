import { getAdminSession } from '@/lib/admin-auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Badge } from '@/components/ui/badge'

const actionColor: Record<string, string> = {
  LOGOUT: 'border-slate-700 text-slate-400',
  UPDATE_TENANT: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
  DELETE_TENANT: 'border-red-500/30 bg-red-500/10 text-red-400',
  SUSPEND_TENANT: 'border-orange-500/30 bg-orange-500/10 text-orange-400',
  REACTIVATE_TENANT: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  IMPERSONATE_TENANT: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
  RESET_TENANT_PASSWORD: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  CREATE_PLAN: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
  UPDATE_PLAN: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
  DELETE_PLAN: 'border-red-500/30 bg-red-500/10 text-red-400',
  CREATE_INVOICE: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400',
}

export default async function LogsPage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')

  const logs = await prisma.adminLog.findMany({
    include: { admin: { select: { email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">Log de Ações ({logs.length})</h1>

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/80 text-slate-400">
            <tr>
              {['Data/Hora', 'Admin', 'Ação', 'IP', 'Detalhes'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {logs.map((log) => (
              <tr key={log.id} className="bg-[#0a0d14] hover:bg-slate-800/40">
                <td className="px-4 py-2 text-slate-400 text-xs">
                  {new Date(log.createdAt).toLocaleString('pt-BR')}
                </td>
                <td className="px-4 py-2 text-slate-300">{log.admin.email}</td>
                <td className="px-4 py-2">
                  <Badge variant="outline" className={`text-[10px] ${actionColor[log.action] ?? 'text-slate-400'}`}>
                    {log.action}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-slate-500 text-xs">{log.ip ?? '—'}</td>
                <td className="px-4 py-2 text-slate-500 text-xs max-w-xs">
                  {log.details
                    ? Object.entries(log.details as Record<string, unknown>)
                        .map(([k, v]) => `${k}: ${String(v)}`)
                        .join(' · ')
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && (
          <p className="py-10 text-center text-slate-500 text-sm">Nenhum log registrado.</p>
        )}
      </div>
    </div>
  )
}
