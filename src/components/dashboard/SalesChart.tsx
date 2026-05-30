'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

type Props = {
  diaAtual: number[] // 24 values (accumulated per hour)
  semanaPassada: number | null // total from last week
}

export function SalesChart({ diaAtual, semanaPassada }: Props) {
  const data = diaAtual.map((valor, hora) => ({
    hora: `${String(hora).padStart(2, '0')}h`,
    hoje: valor > 0 ? valor : null,
    semanaPassada:
      semanaPassada != null && semanaPassada > 0
        ? parseFloat(((semanaPassada / 24) * (hora + 1)).toFixed(2))
        : undefined,
  }))

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)' }}
    >
      <p className="text-sm font-semibold mb-4" style={{ color: 'var(--tf-txt)' }}>
        Vendas acumuladas — hoje vs semana passada
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--tf-border)" />
          <XAxis
            dataKey="hora"
            tick={{ fontSize: 11, fill: 'var(--tf-txt3)' }}
            interval={3}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--tf-txt3)' }}
            tickFormatter={(v: number) =>
              v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`
            }
            width={60}
          />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(v: any) =>
              typeof v === 'number'
                ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                : String(v ?? '')
            }
            contentStyle={{
              background: 'var(--tf-surface)',
              border: '1px solid var(--tf-border)',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="hoje"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
            name="Hoje"
            connectNulls={false}
          />
          {semanaPassada != null && (
            <Line
              type="monotone"
              dataKey="semanaPassada"
              stroke="var(--tf-txt3)"
              strokeWidth={1.5}
              strokeDasharray="4 2"
              dot={false}
              name="Semana passada"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
