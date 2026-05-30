'use client'

import { useState, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TrendingUp, TrendingDown } from 'lucide-react'

const DOW_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

type Metrica = {
  metrica: string
  p1: number | string
  p2: number | string
  diferenca: number | null
  variacao: number | null
}

type ChartPoint = { dow: number; total: number }

type ApiData = {
  metricas: Metrica[]
  periodo1Charts: ChartPoint[]
  periodo2Charts: ChartPoint[]
}

function fmt(v: number | string) {
  if (typeof v === 'string') return v
  if (Number.isInteger(v)) return v.toString()
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function VarCell({ v, diff }: { v: number | null; diff: number | null }) {
  if (v === null || diff === null) return <TableCell>—</TableCell>
  const up = v >= 0
  return (
    <TableCell style={{ color: up ? 'var(--tf-green-ok)' : 'var(--tf-red)', fontSize: 12, fontWeight: 600 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        {fmt(diff)} ({v >= 0 ? '+' : ''}{v.toFixed(1)}%)
      </div>
    </TableCell>
  )
}

export function ComparisonReport() {
  const [p1Start, setP1Start] = useState(() => new Date().toISOString().split('T')[0])
  const [p1End, setP1End] = useState(() => new Date().toISOString().split('T')[0])
  const [p2Start, setP2Start] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1)
    return d.toISOString().split('T')[0]
  })
  const [p2End, setP2End] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1)
    return d.toISOString().split('T')[0]
  })
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/relatorios/comparativo?startDate1=${p1Start}&endDate1=${p1End}&startDate2=${p2Start}&endDate2=${p2End}`)
      if (res.ok) setData(await res.json())
    } catch { /* silent */ } finally { setLoading(false) }
  }, [p1Start, p1End, p2Start, p2End])

  const DatePicker = ({ label, start, end, onStart, onEnd }: { label: string; start: string; end: string; onStart: (v: string) => void; onEnd: (v: string) => void }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--tf-txt3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input type="date" value={start} onChange={(e) => onStart(e.target.value)}
          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--tf-border)', background: 'var(--tf-input-bg)', color: 'var(--tf-txt)', fontSize: 12, outline: 'none' }} />
        <span style={{ fontSize: 12, color: 'var(--tf-txt3)' }}>até</span>
        <input type="date" value={end} min={start} onChange={(e) => onEnd(e.target.value)}
          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--tf-border)', background: 'var(--tf-input-bg)', color: 'var(--tf-txt)', fontSize: 12, outline: 'none' }} />
      </div>
    </div>
  )

  const chartData = data
    ? DOW_LABELS.map((label, dow) => ({
        dow: label,
        periodo1: data.periodo1Charts.find((c) => c.dow === dow)?.total ?? 0,
        periodo2: data.periodo2Charts.find((c) => c.dow === dow)?.total ?? 0,
      }))
    : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Period selectors */}
      <Card style={{ border: '1px solid var(--tf-border)', background: 'var(--tf-surface)' }}>
        <CardContent style={{ paddingTop: 16 }}>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <DatePicker label="Período 1" start={p1Start} end={p1End} onStart={setP1Start} onEnd={setP1End} />
            <DatePicker label="Período 2" start={p2Start} end={p2End} onStart={setP2Start} onEnd={setP2End} />
            <button
              onClick={load}
              disabled={loading}
              style={{ padding: '7px 16px', borderRadius: 7, background: 'var(--tf-primary)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Comparando...' : 'Comparar'}
            </button>
          </div>
        </CardContent>
      </Card>

      {data && (
        <>
          {/* Metrics table */}
          <Card style={{ border: '1px solid var(--tf-border)', background: 'var(--tf-surface)' }}>
            <CardHeader><CardTitle style={{ fontSize: 14, color: 'var(--tf-txt)' }}>Comparativo de Métricas</CardTitle></CardHeader>
            <CardContent style={{ padding: 0 }}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="hover:bg-transparent">Métrica</TableHead>
                    <TableHead className="hover:bg-transparent">Período 1</TableHead>
                    <TableHead className="hover:bg-transparent">Período 2</TableHead>
                    <TableHead className="hover:bg-transparent">Diferença / Variação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.metricas.map((m) => (
                    <TableRow key={m.metrica}>
                      <TableCell style={{ fontSize: 12, fontWeight: 500 }}>{m.metrica}</TableCell>
                      <TableCell style={{ fontSize: 12 }}>{typeof m.p1 === 'number' ? fmt(m.p1) : m.p1}</TableCell>
                      <TableCell style={{ fontSize: 12 }}>{typeof m.p2 === 'number' ? fmt(m.p2) : m.p2}</TableCell>
                      <VarCell v={m.variacao} diff={m.diferenca} />
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Line chart */}
          <Card style={{ border: '1px solid var(--tf-border)', background: 'var(--tf-surface)' }}>
            <CardHeader><CardTitle style={{ fontSize: 14, color: 'var(--tf-txt)' }}>Vendas por dia da semana</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--tf-border)" />
                  <XAxis dataKey="dow" tick={{ fontSize: 11, fill: 'var(--tf-txt2)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--tf-txt3)' }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', fontSize: 12 }}
                    formatter={(v: unknown, name: unknown) => [new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v as number), name === 'periodo1' ? 'Período 1' : 'Período 2']} />
                  <Legend formatter={(v) => v === 'periodo1' ? 'Período 1' : 'Período 2'} />
                  <Line type="monotone" dataKey="periodo1" stroke="#2a9d6f" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="periodo2" stroke="var(--tf-txt3)" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}

      {!data && !loading && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--tf-txt3)', fontSize: 14 }}>
          Selecione os períodos e clique em Comparar.
        </div>
      )}
    </div>
  )
}
