'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Props {
  data: Array<{ month: string; value: number }>
}

export function SignupsChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} />
        <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
        <Tooltip
          contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6 }}
          formatter={(v) => [Number(v ?? 0), 'Cadastros']}
        />
        <Bar dataKey="value" fill="#818cf8" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
