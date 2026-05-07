'use client'

import { PieChart, Pie, Tooltip, ResponsiveContainer } from 'recharts'

const COLORS = ['#38bdf8', '#818cf8', '#34d399', '#fb923c', '#f472b6']

interface Props {
  data: Array<{ planName: string; count: number }>
}

interface LabelProps {
  name?: string
  percent?: number
}

export function PlanDistributionChart({ data }: Props) {
  // Inject fill directly into data so recharts colors each slice without <Cell>
  const mapped = data.map((d, i) => ({
    name: d.planName,
    value: d.count,
    fill: COLORS[i % COLORS.length],
  }))

  function renderLabel({ name, percent }: LabelProps) {
    return `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={mapped}
          cx="50%"
          cy="50%"
          outerRadius={80}
          dataKey="value"
          label={renderLabel}
          labelLine={false}
        />
        <Tooltip
          contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6 }}
          formatter={(v) => [Number(v ?? 0), 'Restaurantes']}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
