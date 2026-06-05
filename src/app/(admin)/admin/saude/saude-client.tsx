'use client'

import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'

interface MetricaItem {
  tipo: string
  log: { valor: number; status: string; registradoEm: string } | null
}
interface Alerta {
  id: string
  tipo: string
  titulo: string
  severidade: string
  criadoEm: string
}
interface HistoricoItem { valor: number; status: string; registradoEm: string }

const STATUS_COLOR: Record<string, string> = {
  OK: '#10b981',
  ALERTA: '#f59e0b',
  CRITICO: '#ef4444',
}

const tooltipStyle = {
  background: '#0f172a',
  border: '1px solid #1e293b',
  borderRadius: 8,
}

export function SaudeClient() {
  const [metricas, setMetricas] = useState<MetricaItem[]>([])
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [historico, setHistorico] = useState<HistoricoItem[]>([])

  async function carregar() {
    const [m, h] = await Promise.all([
      fetch('/api/admin/saude/metricas').then((r) => r.json()),
      fetch('/api/admin/saude/historico?horas=24').then((r) => r.json()),
    ])
    setMetricas(m.metricas ?? [])
    setAlertas(m.alertas ?? [])
    setHistorico(Array.isArray(h) ? h : [])
  }

  useEffect(() => { carregar() }, [])

  async function resolverAlerta(id: string) {
    await fetch(`/api/admin/saude/alertas/${id}`, { method: 'PATCH' })
    setAlertas((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold text-white">Saúde da Plataforma</h1>

      <div className="grid grid-cols-5 gap-3">
        {metricas.map(({ tipo, log }) => (
          <div
            key={tipo}
            className="rounded-xl border border-slate-800 bg-slate-900 p-5"
            style={{ borderTop: `3px solid ${STATUS_COLOR[log?.status ?? 'OK']}` }}
          >
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">{tipo}</div>
            <div className="text-lg font-bold text-white">{log ? Number(log.valor).toFixed(1) : '—'}</div>
            <span
              className="mt-1 inline-block rounded px-1.5 py-px text-[10px] font-semibold text-white"
              style={{ background: STATUS_COLOR[log?.status ?? 'OK'] }}
            >
              {log?.status ?? 'SEM DADOS'}
            </span>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Latência das últimas 24h (ms)</h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={historico.map((h) => ({ ...h, valor: Number(h.valor) }))}>
            <XAxis
              dataKey="registradoEm"
              tickFormatter={(v) => new Date(v).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
            />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => new Date(v).toLocaleString('pt-BR')} />
            <ReferenceLine y={2000} stroke="#ef4444" strokeDasharray="4 4" label={{ value: '2000ms', fill: '#ef4444', fontSize: 10 }} />
            <Line type="monotone" dataKey="valor" stroke="#6366f1" dot={false} strokeWidth={1.5} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {alertas.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Alertas Ativos</h2>
          <div className="overflow-hidden rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/80">
                <tr>
                  {['Tipo', 'Título', 'Severidade', 'Horário', 'Ação'].map((col) => (
                    <th key={col} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-800">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {alertas.map((a) => (
                  <tr key={a.id} className="bg-[#0a0d14]">
                    <td className="px-3 py-2.5 text-sm text-white">{a.tipo}</td>
                    <td className="px-3 py-2.5 text-sm text-white">{a.titulo}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className="rounded px-2 py-0.5 text-[11px] font-semibold text-white"
                        style={{ background: STATUS_COLOR[a.severidade] ?? '#6b7280' }}
                      >
                        {a.severidade}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-400">{new Date(a.criadoEm).toLocaleString('pt-BR')}</td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => resolverAlerta(a.id)}
                        className="rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
                      >
                        Resolver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {metricas.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-400 text-sm">
          Nenhuma métrica coletada ainda. Inicie o worker BullMQ para começar a monitorar.
        </div>
      )}
    </div>
  )
}
