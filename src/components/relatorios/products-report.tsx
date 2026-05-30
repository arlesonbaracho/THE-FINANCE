'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search } from 'lucide-react'
import { exportCSV } from '@/lib/report-export'

type Product = {
  id: string; nome: string; imagem: string | null; categoria: string
  qtdVendida: number; receita: number; pctReceita: number
  custoTotal: number; margem: number; margemPct: number
  ticketMedio: number; ranking: number; classeABC: 'A' | 'B' | 'C'
}

type SortDir = 'asc' | 'desc'
type SortKey = keyof Product

const ABC_COLORS: Record<string, string> = { A: 'var(--tf-green-ok)', B: '#f59e0b', C: 'var(--tf-txt3)' }
const ABC_BG: Record<string, string> = { A: 'var(--tf-green-ok-bg)', B: 'var(--tf-yellow-bg)', C: 'var(--tf-surface2)' }

function fmt(v: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) }

export function ProductsReport({ startDate, endDate }: { startDate: string; endDate: string }) {
  const [data, setData] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [abcFilter, setAbcFilter] = useState<'A' | 'B' | 'C' | ''>('')
  const [sortKey, setSortKey] = useState<SortKey>('receita')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/relatorios/produtos?startDate=${startDate}&endDate=${endDate}`)
      if (res.ok) setData(await res.json())
    } catch { /* silent */ } finally { setLoading(false) }
  }, [startDate, endDate])

  useEffect(() => { load() }, [load])

  const categories = useMemo(() => Array.from(new Set(data.map((d) => d.categoria))).sort(), [data])

  const filtered = useMemo(() => {
    return data
      .filter((p) => (!search || p.nome.toLowerCase().includes(search.toLowerCase())))
      .filter((p) => (!catFilter || p.categoria === catFilter))
      .filter((p) => (!abcFilter || p.classeABC === abcFilter))
      .sort((a, b) => {
        const av = a[sortKey] as number | string
        const bv = b[sortKey] as number | string
        const cmp = av < bv ? -1 : av > bv ? 1 : 0
        return sortDir === 'asc' ? cmp : -cmp
      })
  }, [data, search, catFilter, abcFilter, sortKey, sortDir])

  const top10 = useMemo(() => [...data].sort((a, b) => b.receita - a.receita).slice(0, 10), [data])

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('desc') }
  }

  function SortTh({ k, label }: { k: SortKey; label: string }) {
    const active = sortKey === k
    return (
      <TableHead onClick={() => toggleSort(k)} style={{ cursor: 'pointer', userSelect: 'none', color: active ? 'var(--tf-primary)' : undefined }} className="hover:bg-transparent">
        {label} {active ? (sortDir === 'asc' ? '↑' : '↓') : ''}
      </TableHead>
    )
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--tf-border)', borderTopColor: 'var(--tf-primary)', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Bar chart top 10 */}
      <Card style={{ border: '1px solid var(--tf-border)', background: 'var(--tf-surface)' }}>
        <CardHeader><CardTitle style={{ fontSize: 14, color: 'var(--tf-txt)' }}>Top 10 — Receita vs Custo</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={top10} layout="vertical" margin={{ top: 0, right: 8, left: 80, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--tf-border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--tf-txt3)' }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="nome" tick={{ fontSize: 10, fill: 'var(--tf-txt2)' }} width={78} />
              <Tooltip
                contentStyle={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', fontSize: 12 }}
                formatter={(v: unknown, name: unknown) => [fmt(v as number), name === 'receita' ? 'Receita' : 'Custo']}
              />
              <Legend formatter={(v) => v === 'receita' ? 'Receita' : 'Custo'} iconSize={10} />
              <Bar dataKey="receita" fill="#2a9d6f" radius={[0, 3, 3, 0]} maxBarSize={16} />
              <Bar dataKey="custoTotal" fill="var(--tf-border)" radius={[0, 3, 3, 0]} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--tf-txt3)' }} />
          <input
            type="text"
            placeholder="Buscar produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 28, paddingRight: 8, height: 32, borderRadius: 6, border: '1px solid var(--tf-border)', background: 'var(--tf-input-bg)', color: 'var(--tf-txt)', fontSize: 12, outline: 'none', width: 200 }}
          />
        </div>
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
          style={{ height: 32, borderRadius: 6, border: '1px solid var(--tf-border)', background: 'var(--tf-input-bg)', color: 'var(--tf-txt)', fontSize: 12, padding: '0 8px', outline: 'none' }}>
          <option value="">Todas as categorias</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 4 }}>
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
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => exportCSV(filtered.map((p) => ({ ranking: p.ranking, nome: p.nome, categoria: p.categoria, qtdVendida: p.qtdVendida, receita: fmt(p.receita), pctReceita: `${p.pctReceita.toFixed(1)}%`, custoTotal: fmt(p.custoTotal), margem: fmt(p.margem), margemPct: `${p.margemPct.toFixed(1)}%`, classeABC: p.classeABC })),
            [{ key: 'ranking', label: '#' }, { key: 'nome', label: 'Produto' }, { key: 'categoria', label: 'Categoria' }, { key: 'qtdVendida', label: 'Qtd vendida' }, { key: 'receita', label: 'Receita' }, { key: 'pctReceita', label: '% receita' }, { key: 'custoTotal', label: 'Custo total' }, { key: 'margem', label: 'Margem R$' }, { key: 'margemPct', label: 'Margem %' }, { key: 'classeABC', label: 'Classe ABC' }],
            'vendas-por-produto'
          )}
          style={{ fontSize: 11, color: 'var(--tf-txt3)', background: 'transparent', border: '1px solid var(--tf-border)', borderRadius: 5, padding: '4px 10px', cursor: 'pointer' }}
        >
          Exportar CSV
        </button>
      </div>

      {/* Table */}
      <div style={{ border: '1px solid var(--tf-border)', borderRadius: 8, overflow: 'hidden', background: 'var(--tf-surface)' }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="hover:bg-transparent" style={{ width: 36 }}>#</TableHead>
              <SortTh k="nome" label="Produto" />
              <SortTh k="categoria" label="Categoria" />
              <SortTh k="qtdVendida" label="Qtd" />
              <SortTh k="receita" label="Receita" />
              <SortTh k="pctReceita" label="% receita" />
              <SortTh k="custoTotal" label="Custo" />
              <SortTh k="margem" label="Margem R$" />
              <SortTh k="margemPct" label="Margem %" />
              <TableHead className="hover:bg-transparent">ABC</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell style={{ fontSize: 12, color: 'var(--tf-txt3)' }}>{p.ranking}</TableCell>
                <TableCell style={{ fontSize: 12, fontWeight: 500 }}>{p.nome}</TableCell>
                <TableCell style={{ fontSize: 12, color: 'var(--tf-txt2)' }}>{p.categoria}</TableCell>
                <TableCell style={{ fontSize: 12 }}>{p.qtdVendida}</TableCell>
                <TableCell style={{ fontSize: 12 }}>{fmt(p.receita)}</TableCell>
                <TableCell style={{ fontSize: 12 }}>{p.pctReceita.toFixed(1)}%</TableCell>
                <TableCell style={{ fontSize: 12 }}>{fmt(p.custoTotal)}</TableCell>
                <TableCell style={{ fontSize: 12 }}>{fmt(p.margem)}</TableCell>
                <TableCell style={{ fontSize: 12, color: p.margemPct < 20 ? 'var(--tf-red)' : p.margemPct >= 40 ? 'var(--tf-green-ok)' : undefined }}>{p.margemPct.toFixed(1)}%</TableCell>
                <TableCell>
                  <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: ABC_BG[p.classeABC], color: ABC_COLORS[p.classeABC] }}>{p.classeABC}</span>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={10} style={{ textAlign: 'center', color: 'var(--tf-txt3)', padding: 24, fontSize: 13 }}>Nenhum produto encontrado.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
