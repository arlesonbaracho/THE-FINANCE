'use client'

import { useEffect, useState, useCallback } from 'react'
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type AbcItem = {
  ingredientId: string; nome: string; unit: string
  qtdConsumida: number; valorConsumido: number
  pctTotal: number; pctAcumulado: number; classe: 'A' | 'B' | 'C'
}

const ABC_COLORS: Record<string, string> = { A: 'var(--tf-green-ok)', B: '#f59e0b', C: 'var(--tf-txt3)' }
const ABC_BG: Record<string, string> = { A: 'var(--tf-green-ok-bg)', B: 'var(--tf-yellow-bg)', C: 'var(--tf-surface2)' }

function fmt(v: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) }

export function AbcCurveReport({ startDate, endDate }: { startDate: string; endDate: string }) {
  const [items, setItems] = useState<AbcItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [abcFilter, setAbcFilter] = useState<'A' | 'B' | 'C' | ''>('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/relatorios/estoque/abc?startDate=${startDate}&endDate=${endDate}`)
      if (res.ok) { const d = await res.json(); setItems(d.itens ?? []); setTotal(d.total ?? 0) }
    } catch { /* silent */ } finally { setLoading(false) }
  }, [startDate, endDate])

  useEffect(() => { load() }, [load])

  const filtered = abcFilter ? items.filter((i) => i.classe === abcFilter) : items
  const chartItems = items.slice(0, 30)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--tf-border)', borderTopColor: 'var(--tf-primary)', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (items.length === 0) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--tf-txt3)', fontSize: 14 }}>Nenhum dado de consumo no período.</div>
  )

  const aCount = items.filter((i) => i.classe === 'A').length
  const bCount = items.filter((i) => i.classe === 'B').length
  const cCount = items.filter((i) => i.classe === 'C').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Summary badges */}
      <div style={{ display: 'flex', gap: 12 }}>
        {[
          { label: 'Classe A', count: aCount, desc: '80% do valor', bg: 'var(--tf-green-ok-bg)', color: 'var(--tf-green-ok)', bd: 'var(--tf-green-ok)' },
          { label: 'Classe B', count: bCount, desc: 'próximos 15%', bg: 'var(--tf-yellow-bg)', color: '#f59e0b', bd: '#f59e0b' },
          { label: 'Classe C', count: cCount, desc: 'últimos 5%', bg: 'var(--tf-surface2)', color: 'var(--tf-txt3)', bd: 'var(--tf-border)' },
        ].map(({ label, count, desc, bg, color, bd }) => (
          <div key={label} style={{ padding: '10px 16px', borderRadius: 8, background: bg, border: `1px solid ${bd}`, minWidth: 140 }}>
            <p style={{ fontSize: 11, color, fontWeight: 700, marginBottom: 2 }}>{label}</p>
            <p style={{ fontSize: 20, fontWeight: 800, color, marginBottom: 2 }}>{count}</p>
            <p style={{ fontSize: 11, color }}>{desc}</p>
          </div>
        ))}
      </div>

      {/* Pareto chart */}
      <Card style={{ border: '1px solid var(--tf-border)', background: 'var(--tf-surface)' }}>
        <CardHeader><CardTitle style={{ fontSize: 14, color: 'var(--tf-txt)' }}>Gráfico de Pareto — Top 30 Insumos</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartItems} margin={{ top: 4, right: 24, left: 8, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--tf-border)" />
              <XAxis dataKey="nome" tick={{ fontSize: 9, fill: 'var(--tf-txt3)' }} angle={-45} textAnchor="end" interval={0} />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: 'var(--tf-txt3)' }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--tf-txt3)' }} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', fontSize: 11 }}
                formatter={(v: unknown, name: unknown) => name === 'pctAcumulado' ? [`${(v as number).toFixed(1)}%`, '% Acumulado'] : [fmt(v as number), 'Valor consumido']}
              />
              <Legend formatter={(v) => v === 'valorConsumido' ? 'Valor consumido' : '% Acumulado'} />
              <Bar yAxisId="left" dataKey="valorConsumido" fill="#2a9d6f" maxBarSize={24} />
              <Line yAxisId="right" type="monotone" dataKey="pctAcumulado" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Filter + table */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
        {(['', 'A', 'B', 'C'] as const).map((cls) => (
          <button key={cls || 'all'} onClick={() => setAbcFilter(cls)}
            style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              border: `1px solid ${abcFilter === cls ? 'var(--tf-primary-bd)' : 'var(--tf-border)'}`,
              background: abcFilter === cls ? 'var(--tf-primary-bg)' : 'transparent',
              color: abcFilter === cls ? 'var(--tf-primary)' : 'var(--tf-txt2)',
              cursor: 'pointer',
            }}>
            {cls || 'Todos'}
          </button>
        ))}
        <span style={{ fontSize: 12, color: 'var(--tf-txt3)', marginLeft: 8, lineHeight: '28px' }}>
          Total: {fmt(total)}
        </span>
      </div>

      <div style={{ border: '1px solid var(--tf-border)', borderRadius: 8, overflow: 'hidden', background: 'var(--tf-surface)' }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="hover:bg-transparent">#</TableHead>
              <TableHead className="hover:bg-transparent">Insumo</TableHead>
              <TableHead className="hover:bg-transparent">Qtd consumida</TableHead>
              <TableHead className="hover:bg-transparent">Valor consumido</TableHead>
              <TableHead className="hover:bg-transparent">% Total</TableHead>
              <TableHead className="hover:bg-transparent">% Acumulado</TableHead>
              <TableHead className="hover:bg-transparent">Classe</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((item, i) => (
              <TableRow key={item.ingredientId}>
                <TableCell style={{ fontSize: 12, color: 'var(--tf-txt3)' }}>{i + 1}</TableCell>
                <TableCell style={{ fontSize: 12, fontWeight: 500 }}>{item.nome}</TableCell>
                <TableCell style={{ fontSize: 12 }}>{item.qtdConsumida.toFixed(2)} {item.unit}</TableCell>
                <TableCell style={{ fontSize: 12 }}>{fmt(item.valorConsumido)}</TableCell>
                <TableCell style={{ fontSize: 12 }}>{item.pctTotal.toFixed(2)}%</TableCell>
                <TableCell style={{ fontSize: 12 }}>{item.pctAcumulado.toFixed(2)}%</TableCell>
                <TableCell>
                  <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: ABC_BG[item.classe], color: ABC_COLORS[item.classe] }}>{item.classe}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
