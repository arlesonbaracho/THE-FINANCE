'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Props {
  data: Array<{ month: string; value: number }>
}

export function MrrChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} />
        <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
        <Tooltip
          contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6 }}
          labelStyle={{ color: '#cbd5e1' }}
          formatter={(v) => [`R$ ${Number(v ?? 0).toFixed(2)}`, 'MRR']}
        />
        <Line type="monotone" dataKey="value" stroke="#38bdf8" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
