'use client'

interface KpiCardProps {
  titulo: string
  valor: string
  variacao?: number
  icone?: React.ReactNode
}

export function KpiCard({ titulo, valor, variacao, icone }: KpiCardProps) {
  const varColor =
    variacao === undefined
      ? 'var(--tf-txt3)'
      : variacao >= 0
      ? 'var(--tf-success, #10b981)'
      : 'var(--tf-danger, #ef4444)'

  return (
    <div
      style={{
        background: 'var(--tf-surface)',
        border: '1px solid var(--tf-border)',
        borderRadius: 12,
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icone}
        <span style={{ fontSize: 12, color: 'var(--tf-txt3)', fontWeight: 500 }}>{titulo}</span>
      </div>
      <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--tf-txt)' }}>{valor}</span>
      {variacao !== undefined && (
        <span style={{ fontSize: 12, color: varColor }}>
          {variacao >= 0 ? '▲' : '▼'} {Math.abs(variacao).toFixed(1)}% vs período anterior
        </span>
      )}
    </div>
  )
}
