'use client'

import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

type Metrica = 'vendas' | 'pedidos' | 'cmv' | 'ticket'

interface UnidadeDado {
  tenantName: string
  totalVendas: number
  totalPedidos: number
  cmvPercentual: number
  ticketMedio: number
}

interface NetworkBarChartProps {
  unidades: UnidadeDado[]
}

const METRICA_CONFIG: Record<Metrica, { label: string; dataKey: string; cor: string }> = {
  vendas:  { label: 'Vendas (R$)',  dataKey: 'totalVendas',   cor: 'var(--tf-primary, #6366f1)' },
  pedidos: { label: 'Pedidos',      dataKey: 'totalPedidos',  cor: '#6366f1' },
  cmv:     { label: 'CMV %',        dataKey: 'cmvPercentual', cor: '#f59e0b' },
  ticket:  { label: 'Ticket Médio', dataKey: 'ticketMedio',   cor: '#10b981' },
}

export function NetworkBarChart({ unidades }: NetworkBarChartProps) {
  const [metrica, setMetrica] = useState<Metrica>('vendas')
  const config = METRICA_CONFIG[metrica]

  return (
    <div
      style={{
        background: 'var(--tf-surface)',
        border: '1px solid var(--tf-border)',
        borderRadius: 12,
        padding: 20,
      }}
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {(Object.keys(METRICA_CONFIG) as Metrica[]).map((m) => (
          <button
            key={m}
            onClick={() => setMetrica(m)}
            style={{
              padding: '4px 12px',
              borderRadius: 6,
              border: '1px solid var(--tf-border)',
              background: metrica === m ? 'var(--tf-primary, #6366f1)' : 'transparent',
              color: metrica === m ? '#fff' : 'var(--tf-txt)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {METRICA_CONFIG[m].label}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={unidades} margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
          <XAxis dataKey="tenantName" tick={{ fontSize: 11, fill: 'var(--tf-txt3)' }} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--tf-txt3)' }} />
          <Tooltip
            contentStyle={{
              background: 'var(--tf-surface)',
              border: '1px solid var(--tf-border)',
              borderRadius: 8,
            }}
          />
          <Bar dataKey={config.dataKey} fill={config.cor} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
