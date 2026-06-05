'use client'

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface AiUsage {
  tenantId: string
  tokensInput: number
  tokensOutput: number
  custoEstimado: number
  limiteTokens: number
  tenant: { name: string; subscription: { plan: { name: string } } | null }
}

const tooltipStyle = { background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }

export function UsoIaClient() {
  const [usages, setUsages] = useState<AiUsage[]>([])
  const [modalTenant, setModalTenant] = useState<string | null>(null)
  const [novoLimite, setNovoLimite] = useState('')

  async function carregar() {
    const d = await fetch('/api/admin/uso-ia').then((r) => r.json())
    setUsages(Array.isArray(d) ? d : [])
  }

  useEffect(() => { carregar() }, [])

  async function salvarLimite() {
    if (!modalTenant) return
    await fetch(`/api/admin/uso-ia/${modalTenant}/limite`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limiteTokens: parseInt(novoLimite, 10) }),
    })
    setModalTenant(null)
    carregar()
  }

  async function resetarContador(tenantId: string) {
    if (!confirm('Resetar contador de tokens deste tenant?')) return
    await fetch(`/api/admin/uso-ia/${tenantId}/limite`, { method: 'POST' })
    carregar()
  }

  const totalHoje = usages.reduce((s, u) => s + u.tokensInput + u.tokensOutput, 0)
  const custoMes = usages.reduce((s, u) => s + Number(u.custoEstimado), 0)
  const acima = usages.filter((u) => u.limiteTokens > 0 && u.tokensInput + u.tokensOutput >= u.limiteTokens).length
  const proximo = usages.filter((u) => {
    if (u.limiteTokens === 0) return false
    const pct = (u.tokensInput + u.tokensOutput) / u.limiteTokens
    return pct >= 0.8 && pct < 1
  }).length

  const top10 = [...usages]
    .sort((a, b) => b.tokensInput + b.tokensOutput - (a.tokensInput + a.tokensOutput))
    .slice(0, 10)
    .map((u) => ({ name: u.tenant.name.slice(0, 14), tokens: u.tokensInput + u.tokensOutput }))

  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold text-white">Uso de IA</h1>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Tokens (plataforma)', valor: totalHoje.toLocaleString('pt-BR') },
          { label: 'Custo estimado (mês)', valor: `R$ ${custoMes.toFixed(2)}` },
          { label: 'Acima do limite', valor: String(acima) },
          { label: 'Próximos do limite', valor: String(proximo) },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <div className="text-[11px] text-slate-400 mb-1.5">{c.label}</div>
            <div className="text-2xl font-bold text-white">{c.valor}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-sm font-semibold text-white mb-3">Top 10 tenants por consumo</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={top10}>
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="tokens" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/80">
            <tr>
              {['Tenant', 'Plano', 'Input', 'Output', 'Custo R$', 'Limite', '% usado', 'Ações'].map((col) => (
                <th key={col} className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-800">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {usages.map((u) => {
              const total = u.tokensInput + u.tokensOutput
              const pct = u.limiteTokens > 0 ? Math.round((total / u.limiteTokens) * 100) : null
              const isAcima = pct !== null && pct >= 100
              const isProximo = pct !== null && pct >= 80 && !isAcima
              return (
                <tr key={u.tenantId} className="bg-[#0a0d14] hover:bg-slate-800/40 transition-colors">
                  <td className="px-3.5 py-2.5 text-sm text-white">{u.tenant.name}</td>
                  <td className="px-3.5 py-2.5 text-xs text-slate-400">{u.tenant.subscription?.plan.name ?? '—'}</td>
                  <td className="px-3.5 py-2.5 text-sm text-slate-300">{u.tokensInput.toLocaleString('pt-BR')}</td>
                  <td className="px-3.5 py-2.5 text-sm text-slate-300">{u.tokensOutput.toLocaleString('pt-BR')}</td>
                  <td className="px-3.5 py-2.5 text-sm text-slate-300">R$ {Number(u.custoEstimado).toFixed(4)}</td>
                  <td className="px-3.5 py-2.5 text-sm text-slate-300">{u.limiteTokens === 0 ? '∞' : u.limiteTokens.toLocaleString('pt-BR')}</td>
                  <td className="px-3.5 py-2.5">
                    {pct !== null ? (
                      <span
                        className="rounded px-2 py-0.5 text-[11px] font-semibold text-white"
                        style={{ background: isAcima ? '#ef4444' : isProximo ? '#f59e0b' : '#10b981' }}
                      >
                        {pct}%
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-3.5 py-2.5">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => { setModalTenant(u.tenantId); setNovoLimite(String(u.limiteTokens)) }}
                        className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800 transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => resetarContador(u.tenantId)}
                        className="rounded-md border border-red-500/30 px-2 py-1 text-[11px] text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        Resetar
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modalTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-8 min-w-[320px] space-y-4">
            <h2 className="text-base font-bold text-white">Editar limite de tokens</h2>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 block">Limite (0 = ilimitado)</label>
              <input
                type="number"
                value={novoLimite}
                onChange={(e) => setNovoLimite(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setModalTenant(null)}
                className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={salvarLimite}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500 transition-colors"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
