'use client'

import { useEffect, useState, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Star, AlertTriangle } from 'lucide-react'

type Produto = { id: string; nome: string; categoria: string; receita: number; custo: number; margem: number; margemPct: number; cmvPct: number; qtd: number; alerta: boolean; estrela: boolean }
type Categoria = { nome: string; receita: number; custo: number; margem: number; margemPct: number; cmvPct: number }
type SerieTempo = { data: string; cmvPct: number; receita: number; custo: number }

type ApiData = { porProduto: Produto[]; porCategoria: Categoria[]; seriesTempo: SerieTempo[] }

function fmt(v: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) }
function fmtDate(d: string) { return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) }

export function CmvReport({ startDate, endDate }: { startDate: string; endDate: string }) {
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'produto' | 'categoria' | 'historico'>('produto')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/relatorios/cmv?startDate=${startDate}&endDate=${endDate}`)
      if (res.ok) setData(await res.json())
    } catch { /* silent */ } finally { setLoading(false) }
  }, [startDate, endDate])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--tf-border)', borderTopColor: 'var(--tf-primary)', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (!data) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--tf-txt3)', fontSize: 14 }}>Nenhum dado no período.</div>

  // Detect consecutive days above 35%
  const alertDays: string[] = []
  let streak = 0
  for (const s of data.seriesTempo) {
    if (s.cmvPct > 35 && s.receita > 0) { streak++; if (streak >= 3) alertDays.push(s.data) }
    else streak = 0
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {alertDays.length > 0 && (
        <div style={{ display: 'flex', gap: 8, padding: 12, borderRadius: 8, background: 'var(--tf-red-bg)', border: '1px solid var(--tf-red-bd)', color: 'var(--tf-red)', fontSize: 12 }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>CMV acima de 35% por 3+ dias consecutivos ({alertDays.length} ocorrência(s)). Revise os custos dos insumos.</span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--tf-border)', gap: 0 }}>
        {(['produto', 'categoria', 'historico'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding: '7px 14px', fontSize: 12, fontWeight: tab === t ? 600 : 400,
              color: tab === t ? 'var(--tf-txt)' : 'var(--tf-txt3)',
              background: 'transparent', border: 'none', borderBottom: `2px solid ${tab === t ? 'var(--tf-primary)' : 'transparent'}`,
              cursor: 'pointer', transition: 'color 120ms',
            }}>
            {t === 'produto' ? 'Por Produto' : t === 'categoria' ? 'Por Categoria' : 'Histórico'}
          </button>
        ))}
      </div>

      {tab === 'produto' && (
        <div style={{ border: '1px solid var(--tf-border)', borderRadius: 8, overflow: 'hidden', background: 'var(--tf-surface)' }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hover:bg-transparent">Produto</TableHead>
                <TableHead className="hover:bg-transparent">Categoria</TableHead>
                <TableHead className="hover:bg-transparent">Receita</TableHead>
                <TableHead className="hover:bg-transparent">Custo</TableHead>
                <TableHead className="hover:bg-transparent">CMV %</TableHead>
                <TableHead className="hover:bg-transparent">Margem R$</TableHead>
                <TableHead className="hover:bg-transparent">Margem %</TableHead>
                <TableHead className="hover:bg-transparent">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.porProduto.map((p) => (
                <TableRow key={p.id}>
                  <TableCell style={{ fontSize: 12, fontWeight: 500 }}>{p.nome}</TableCell>
                  <TableCell style={{ fontSize: 12, color: 'var(--tf-txt2)' }}>{p.categoria}</TableCell>
                  <TableCell style={{ fontSize: 12 }}>{fmt(p.receita)}</TableCell>
                  <TableCell style={{ fontSize: 12 }}>{fmt(p.custo)}</TableCell>
                  <TableCell style={{ fontSize: 12, color: p.cmvPct > 35 ? 'var(--tf-red)' : 'var(--tf-green-ok)', fontWeight: 600 }}>{p.cmvPct.toFixed(1)}%</TableCell>
                  <TableCell style={{ fontSize: 12 }}>{fmt(p.margem)}</TableCell>
                  <TableCell style={{ fontSize: 12, color: p.margemPct < 20 ? 'var(--tf-red)' : undefined }}>{p.margemPct.toFixed(1)}%</TableCell>
                  <TableCell>
                    {p.estrela && <span title="Produto estrela" style={{ color: '#f59e0b' }}><Star size={14} /></span>}
                    {p.alerta && <span title="Margem baixa" style={{ color: 'var(--tf-red)' }}><AlertTriangle size={14} /></span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {tab === 'categoria' && (
        <div style={{ border: '1px solid var(--tf-border)', borderRadius: 8, overflow: 'hidden', background: 'var(--tf-surface)' }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hover:bg-transparent">Categoria</TableHead>
                <TableHead className="hover:bg-transparent">Receita</TableHead>
                <TableHead className="hover:bg-transparent">Custo</TableHead>
                <TableHead className="hover:bg-transparent">CMV %</TableHead>
                <TableHead className="hover:bg-transparent">Margem R$</TableHead>
                <TableHead className="hover:bg-transparent">Margem %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.porCategoria.map((c) => (
                <TableRow key={c.nome}>
                  <TableCell style={{ fontSize: 12, fontWeight: 500 }}>{c.nome}</TableCell>
                  <TableCell style={{ fontSize: 12 }}>{fmt(c.receita)}</TableCell>
                  <TableCell style={{ fontSize: 12 }}>{fmt(c.custo)}</TableCell>
                  <TableCell style={{ fontSize: 12, color: c.cmvPct > 35 ? 'var(--tf-red)' : 'var(--tf-green-ok)', fontWeight: 600 }}>{c.cmvPct.toFixed(1)}%</TableCell>
                  <TableCell style={{ fontSize: 12 }}>{fmt(c.margem)}</TableCell>
                  <TableCell style={{ fontSize: 12, color: c.margemPct < 20 ? 'var(--tf-red)' : undefined }}>{c.margemPct.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {tab === 'historico' && (
        <Card style={{ border: '1px solid var(--tf-border)', background: 'var(--tf-surface)' }}>
          <CardHeader><CardTitle style={{ fontSize: 14, color: 'var(--tf-txt)' }}>CMV% ao longo do tempo</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data.seriesTempo.filter((s) => s.receita > 0)}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--tf-border)" />
                <XAxis dataKey="data" tick={{ fontSize: 10, fill: 'var(--tf-txt3)' }} tickFormatter={fmtDate} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--tf-txt3)' }} tickFormatter={(v) => `${v}%`} domain={[0, 'auto']} />
                <Tooltip
                  contentStyle={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', fontSize: 12 }}
                  formatter={(v: unknown) => [`${(v as number).toFixed(1)}%`, 'CMV%']}
                  labelFormatter={(d) => fmtDate(String(d ?? ''))}
                />
                <ReferenceLine y={35} stroke="var(--tf-red)" strokeDasharray="4 2" label={{ value: 'Benchmark 35%', fill: 'var(--tf-red)', fontSize: 10 }} />
                <Line type="monotone" dataKey="cmvPct" stroke="#2a9d6f" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
