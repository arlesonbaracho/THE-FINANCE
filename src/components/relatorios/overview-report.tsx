'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TrendingUp, TrendingDown, ShoppingCart, DollarSign, BarChart3 } from 'lucide-react'
import { invalidateCache } from '@/lib/client-cache'
import { exportCSV } from '@/lib/report-export'

type KPIs = { totalVendas: number; numPedidos: number; ticketMedio: number; cmvTotal: number; cmvPct: number }
type Variacao = { totalVendas: number; numPedidos: number; ticketMedio: number; cmvTotal: number }
type ChartPoint = { data: string; vendas: number; pedidos: number; ticketMedio: number; cmv: number }
type Categoria = { nome: string; total: number; pct: number }
type DiaResumo = { data: string; pedidos: number; total: number; ticketMedio: number; cmv: number; margem: number }

type ApiData = {
  kpis: KPIs
  variacaoAnterior: Variacao
  chartData: ChartPoint[]
  categorias: Categoria[]
  resumoDiario: DiaResumo[]
}

const PIE_COLORS = ['#2a9d6f', '#4bc994', '#52b788', '#74c69d', '#95d5b2', '#b7e4c7', '#d8f3dc', '#1b4332']

function fmt(v: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(v) }
function pct(v: number) { return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` }
function fmtDate(d: string) { return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') }

function VarBadge({ value }: { value: number }) {
  const up = value >= 0
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: up ? 'var(--tf-green-ok)' : 'var(--tf-red)', fontWeight: 600 }}>
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {pct(value)}
    </span>
  )
}

type SortDir = 'asc' | 'desc'
type SortKey = keyof DiaResumo

export function OverviewReport({ startDate, endDate, onDataReady }: { startDate: string; endDate: string; onDataReady?: (data: ApiData) => void }) {
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCmv, setShowCmv] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('data')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const url = `/api/relatorios/vendas?startDate=${startDate}&endDate=${endDate}`
      const res = await fetch(url)
      if (!res.ok) throw new Error()
      const d: ApiData = await res.json()
      setData(d)
      onDataReady?.(d)
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }, [startDate, endDate, onDataReady])

  useEffect(() => { load() }, [load])

  const sortedDiario = useMemo(() => {
    if (!data) return []
    return [...data.resumoDiario].sort((a, b) => {
      const av = a[sortKey] as number | string
      const bv = b[sortKey] as number | string
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  function SortTh({ k, label }: { k: SortKey; label: string }) {
    const active = sortKey === k
    return (
      <TableHead
        onClick={() => toggleSort(k)}
        style={{ cursor: 'pointer', userSelect: 'none', color: active ? 'var(--tf-primary)' : undefined }}
        className="hover:bg-transparent"
      >
        {label} {active ? (sortDir === 'asc' ? '↑' : '↓') : ''}
      </TableHead>
    )
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--tf-border)', borderTopColor: 'var(--tf-primary)', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (!data) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--tf-txt3)', fontSize: 14 }}>Nenhum dado encontrado para o período.</div>
  }

  const { kpis, variacaoAnterior, chartData, categorias } = data
  const totalDia = sortedDiario.reduce((s, d) => ({ total: s.total + d.total, pedidos: s.pedidos + d.pedidos, cmv: s.cmv + d.cmv }), { total: 0, pedidos: 0, cmv: 0 })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {[
          { label: 'Total de Vendas', value: fmt(kpis.totalVendas), var: variacaoAnterior.totalVendas, icon: DollarSign },
          { label: 'Nº de Pedidos', value: kpis.numPedidos.toString(), var: variacaoAnterior.numPedidos, icon: ShoppingCart },
          { label: 'Ticket Médio', value: fmt(kpis.ticketMedio), var: variacaoAnterior.ticketMedio, icon: BarChart3 },
          { label: 'CMV', value: `${fmt(kpis.cmvTotal)} (${kpis.cmvPct.toFixed(1)}%)`, var: variacaoAnterior.cmvTotal, icon: TrendingUp, cmv: kpis.cmvPct },
        ].map(({ label, value, var: v, icon: Icon, cmv: cmvPct }) => (
          <Card key={label} style={{ border: '1px solid var(--tf-border)', background: 'var(--tf-surface)' }}>
            <CardContent style={{ paddingTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--tf-txt3)', marginBottom: 4 }}>{label}</p>
                  <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--tf-txt)', marginBottom: 4 }}>{value}</p>
                  <VarBadge value={v} />
                </div>
                <Icon size={18} style={{ color: 'var(--tf-txt3)', marginTop: 2 }} />
              </div>
              {cmvPct !== undefined && (
                <span style={{
                  display: 'inline-block', marginTop: 6, padding: '2px 8px', borderRadius: 12,
                  fontSize: 10, fontWeight: 700,
                  background: cmvPct <= 35 ? 'var(--tf-green-ok-bg)' : 'var(--tf-red-bg)',
                  color: cmvPct <= 35 ? 'var(--tf-green-ok)' : 'var(--tf-red)',
                }}>
                  {cmvPct <= 35 ? '✓ Dentro do benchmark' : '⚠ Acima de 35%'}
                </span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Area Chart */}
      <Card style={{ border: '1px solid var(--tf-border)', background: 'var(--tf-surface)' }}>
        <CardHeader style={{ paddingBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <CardTitle style={{ fontSize: 14, color: 'var(--tf-txt)' }}>Evolução de Vendas</CardTitle>
            <button
              onClick={() => setShowCmv((v) => !v)}
              style={{
                padding: '3px 10px', borderRadius: 6, fontSize: 11,
                background: showCmv ? 'var(--tf-primary-bg)' : 'transparent',
                color: showCmv ? 'var(--tf-primary)' : 'var(--tf-txt2)',
                border: `1px solid ${showCmv ? 'var(--tf-primary-bd)' : 'var(--tf-border)'}`,
                cursor: 'pointer',
              }}
            >
              {showCmv ? '✓ ' : ''}Sobrepor CMV
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="vendas-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2a9d6f" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2a9d6f" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--tf-border)" />
              <XAxis dataKey="data" tick={{ fontSize: 10, fill: 'var(--tf-txt3)' }} tickFormatter={(v) => fmtDate(v)} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--tf-txt3)' }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', borderRadius: 8, fontSize: 12 }}
                formatter={(value: unknown, name: unknown) => [fmt(value as number), name === 'vendas' ? 'Vendas' : 'CMV']}
                labelFormatter={(label) => fmtDate(String(label ?? ''))}
              />
              <Area type="monotone" dataKey="vendas" stroke="#2a9d6f" fill="url(#vendas-grad)" strokeWidth={2} />
              {showCmv && <Area type="monotone" dataKey="cmv" stroke="#f87171" fill="none" strokeWidth={1.5} strokeDasharray="4 2" />}
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Category pie + daily summary side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 12 }}>
        {/* Pie chart */}
        <Card style={{ border: '1px solid var(--tf-border)', background: 'var(--tf-surface)' }}>
          <CardHeader><CardTitle style={{ fontSize: 14, color: 'var(--tf-txt)' }}>Por Categoria</CardTitle></CardHeader>
          <CardContent>
            <PieChart width={280} height={200}>
              <Pie data={categorias} dataKey="total" nameKey="nome" cx="40%" cy="50%" innerRadius={50} outerRadius={80}>
                {categorias.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                formatter={(value, entry) => (
                  <span style={{ fontSize: 11, color: 'var(--tf-txt2)' }}>
                    {value} ({(entry.payload as Categoria).pct.toFixed(1)}%)
                  </span>
                )}
              />
              <Tooltip
                contentStyle={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', fontSize: 12 }}
                formatter={(v: unknown) => [fmt(v as number), 'Receita']}
              />
            </PieChart>
          </CardContent>
        </Card>

        {/* Daily summary table */}
        <Card style={{ border: '1px solid var(--tf-border)', background: 'var(--tf-surface)' }}>
          <CardHeader style={{ paddingBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <CardTitle style={{ fontSize: 14, color: 'var(--tf-txt)' }}>Resumo Diário</CardTitle>
              <button
                onClick={() => exportCSV(
                  sortedDiario.map((d) => ({ ...d, data: fmtDate(d.data), total: fmt(d.total), ticketMedio: fmt(d.ticketMedio), cmv: fmt(d.cmv), margem: `${d.margem.toFixed(1)}%` })),
                  [
                    { key: 'data', label: 'Data' },
                    { key: 'pedidos', label: 'Pedidos' },
                    { key: 'total', label: 'Total (R$)' },
                    { key: 'ticketMedio', label: 'Ticket médio' },
                    { key: 'cmv', label: 'CMV' },
                    { key: 'margem', label: 'Margem %' },
                  ],
                  'resumo-diario'
                )}
                style={{ fontSize: 11, color: 'var(--tf-txt3)', background: 'transparent', border: '1px solid var(--tf-border)', borderRadius: 5, padding: '2px 8px', cursor: 'pointer' }}
              >
                CSV
              </button>
            </div>
          </CardHeader>
          <CardContent style={{ padding: 0, maxHeight: 220, overflowY: 'auto' }}>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortTh k="data" label="Data" />
                  <SortTh k="pedidos" label="Pedidos" />
                  <SortTh k="total" label="Total" />
                  <SortTh k="ticketMedio" label="Ticket méd." />
                  <SortTh k="cmv" label="CMV" />
                  <SortTh k="margem" label="Margem %" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedDiario.map((d) => (
                  <TableRow key={d.data}>
                    <TableCell style={{ fontSize: 12 }}>{fmtDate(d.data)}</TableCell>
                    <TableCell style={{ fontSize: 12 }}>{d.pedidos}</TableCell>
                    <TableCell style={{ fontSize: 12 }}>{fmt(d.total)}</TableCell>
                    <TableCell style={{ fontSize: 12 }}>{fmt(d.ticketMedio)}</TableCell>
                    <TableCell style={{ fontSize: 12 }}>{fmt(d.cmv)}</TableCell>
                    <TableCell style={{ fontSize: 12, color: d.margem < 20 ? 'var(--tf-red)' : 'var(--tf-green-ok)' }}>{d.margem.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {/* Totals row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr', padding: '6px 16px', background: 'var(--tf-surface2)', borderTop: '1px solid var(--tf-border)', fontSize: 12, fontWeight: 600, color: 'var(--tf-txt)' }}>
              <span>Total</span>
              <span>{totalDia.pedidos}</span>
              <span>{fmt(totalDia.total)}</span>
              <span>{totalDia.pedidos > 0 ? fmt(totalDia.total / totalDia.pedidos) : '—'}</span>
              <span>{fmt(totalDia.cmv)}</span>
              <span>{totalDia.total > 0 ? `${(((totalDia.total - totalDia.cmv) / totalDia.total) * 100).toFixed(1)}%` : '—'}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
