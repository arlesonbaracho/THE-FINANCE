'use client'

import { useEffect, useState } from 'react'
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { cn } from '@/lib/utils'

type Tab = 'mrr' | 'metricas' | 'cohort' | 'projecao'

interface MRRSnapshot { data: string; mrr: number }
interface Metricas { churn: { churnRate: number }; ltv: number; nrr: number; cac: number | null }
interface CohortRow { cohort: string; retencao: number[] }
interface ProjecaoItem { mes: string; mrr: number; mrrMin: number; mrrMax: number }

const tooltipStyle = { background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }

function corRetencao(v: number) {
  if (v >= 90) return '#166534'
  if (v >= 70) return '#16a34a'
  if (v >= 50) return '#f59e0b'
  return '#ef4444'
}

export function FinanceiroClient() {
  const [tab, setTab] = useState<Tab>('mrr')
  const [mrr, setMrr] = useState<{ atual: { total: number; porPlano: Record<string, number> }; historico: MRRSnapshot[] } | null>(null)
  const [metricas, setMetricas] = useState<Metricas | null>(null)
  const [cohort, setCohort] = useState<CohortRow[]>([])
  const [projecao, setProjecao] = useState<ProjecaoItem[]>([])
  const [cacInput, setCacInput] = useState('')

  useEffect(() => {
    if (tab === 'mrr' && !mrr) {
      fetch('/api/admin/financeiro/mrr').then((r) => r.json()).then(setMrr)
    }
    if (tab === 'metricas' && !metricas) {
      fetch('/api/admin/financeiro/metricas').then((r) => r.json()).then(setMetricas)
    }
    if (tab === 'cohort' && cohort.length === 0) {
      fetch('/api/admin/financeiro/cohort').then((r) => r.json()).then((d) => setCohort(Array.isArray(d) ? d : []))
    }
    if (tab === 'projecao' && projecao.length === 0) {
      fetch('/api/admin/financeiro/projecao').then((r) => r.json()).then((d) => setProjecao(Array.isArray(d) ? d : []))
    }
  }, [tab])

  const tabLabels: Record<Tab, string> = { mrr: 'MRR', metricas: 'Métricas', cohort: 'Cohort', projecao: 'Projeção' }

  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold text-white">Financeiro SaaS</h1>

      <div className="flex gap-1">
        {(['mrr', 'metricas', 'cohort', 'projecao'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              tab === t
                ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
            )}
          >
            {tabLabels[t]}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        {tab === 'mrr' && mrr && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border border-slate-800 bg-[#0a0d14] p-4">
                <div className="text-[11px] text-slate-400 mb-1">MRR Total</div>
                <div className="text-2xl font-bold text-white">R$ {mrr.atual.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-[#0a0d14] p-4">
                <div className="text-[11px] text-slate-400 mb-1">ARR Projetado</div>
                <div className="text-2xl font-bold text-white">R$ {(mrr.atual.total * 12).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-[#0a0d14] p-4">
                <div className="text-[11px] text-slate-400 mb-1">Por plano</div>
                {Object.entries(mrr.atual.porPlano).map(([id, v]) => (
                  <div key={id} className="text-sm text-slate-300">{id.slice(0, 8)}: R$ {Number(v).toFixed(2)}</div>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={mrr.historico.map((h) => ({ ...h, mrr: Number(h.mrr) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="data" tickFormatter={(v) => String(v).slice(0, 7)} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="mrr" stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {tab === 'metricas' && metricas && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Churn Rate', valor: `${metricas.churn.churnRate.toFixed(1)}%` },
                { label: 'LTV Médio', valor: `R$ ${metricas.ltv.toFixed(2)}` },
                { label: 'NRR', valor: `${metricas.nrr.toFixed(1)}%` },
                { label: 'CAC', valor: metricas.cac ? `R$ ${metricas.cac}` : 'Não definido' },
              ].map((c) => (
                <div key={c.label} className="rounded-lg border border-slate-800 bg-[#0a0d14] p-4">
                  <div className="text-[11px] text-slate-400 mb-1">{c.label}</div>
                  <div className="text-2xl font-bold text-white">{c.valor}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 items-center">
              <input
                placeholder="Novo CAC (R$)"
                value={cacInput}
                onChange={(e) => setCacInput(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={async () => {
                  const agora = new Date()
                  await fetch('/api/admin/financeiro/metricas', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mes: agora.getMonth() + 1, ano: agora.getFullYear(), cac: parseFloat(cacInput) }),
                  })
                  fetch('/api/admin/financeiro/metricas').then((r) => r.json()).then(setMetricas)
                  setCacInput('')
                }}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500 transition-colors"
              >
                Salvar CAC
              </button>
            </div>
          </div>
        )}

        {tab === 'cohort' && (
          <div className="overflow-x-auto">
            {cohort.length === 0 ? (
              <p className="text-slate-400 text-sm">Sem dados de cohort ainda (requer pelo menos 1 mês de dados).</p>
            ) : (
              <table className="border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left text-slate-400 font-semibold border-b border-slate-800 whitespace-nowrap">Cohort</th>
                    {cohort[0]?.retencao.map((_, i) => (
                      <th key={i} className="px-3 py-2 text-center text-slate-400 font-semibold border-b border-slate-800">M{i}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cohort.map((row) => (
                    <tr key={row.cohort}>
                      <td className="px-3 py-2 font-semibold text-white border-b border-slate-800 whitespace-nowrap">{row.cohort}</td>
                      {row.retencao.map((v, i) => (
                        <td
                          key={i}
                          title={`${row.cohort} — M${i}: ${v}%`}
                          className="px-3 py-2 text-center font-semibold text-white border-b border-black/10"
                          style={{ background: corRetencao(v) }}
                        >
                          {v}%
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'projecao' && (
          <div className="space-y-6">
            {projecao.length === 0 ? (
              <p className="text-slate-400 text-sm">Sem dados de snapshots suficientes para projeção (mínimo 2 meses).</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4">
                  {projecao.map((p, i) => (
                    <div key={p.mes} className="rounded-lg border border-slate-800 bg-[#0a0d14] p-4">
                      <div className="text-[11px] text-slate-400 mb-1">Mês {i + 1} ({p.mes})</div>
                      <div className="text-2xl font-bold text-white">R$ {p.mrr.toLocaleString('pt-BR')}</div>
                      <div className="text-[11px] text-slate-500 mt-1">R$ {p.mrrMin.toLocaleString('pt-BR')} – R$ {p.mrrMax.toLocaleString('pt-BR')}</div>
                    </div>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={projecao}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                    <Line type="monotone" dataKey="mrr" stroke="#6366f1" strokeWidth={2} strokeDasharray="6 3" name="Projeção" />
                    <Line type="monotone" dataKey="mrrMin" stroke="#6b7280" strokeWidth={1} strokeDasharray="2 4" name="Mínimo" dot={false} />
                    <Line type="monotone" dataKey="mrrMax" stroke="#6b7280" strokeWidth={1} strokeDasharray="2 4" name="Máximo" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
                <p className="text-[11px] text-slate-500">* Projeção baseada na taxa de crescimento média dos últimos snapshots. Intervalo de confiança: ±15%.</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
