import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon: LucideIcon
  variant?: 'default' | 'warning' | 'success' | 'danger'
}

const iconStyle: Record<NonNullable<StatCardProps['variant']>, React.CSSProperties> = {
  default: { background: 'var(--tf-input-bg)',    color: 'var(--tf-txt3)' },
  success: { background: 'var(--tf-green-ok-bg)', color: 'var(--tf-green-ok)' },
  warning: { background: 'var(--tf-yellow-bg)',   color: 'var(--tf-yellow)' },
  danger:  { background: 'var(--tf-red-bg)',      color: 'var(--tf-red)' },
}

const valueColor: Record<NonNullable<StatCardProps['variant']>, string> = {
  default: 'var(--tf-txt)',
  success: 'var(--tf-green-ok)',
  warning: 'var(--tf-yellow)',
  danger:  'var(--tf-red)',
}

const glowColor: Record<NonNullable<StatCardProps['variant']>, string> = {
  default: 'var(--tf-txt3)',
  success: 'var(--tf-green-ok)',
  warning: 'var(--tf-yellow)',
  danger:  'var(--tf-red)',
}

export function StatCard({ title, value, description, icon: Icon, variant = 'default' }: StatCardProps) {
  return (
    <div
      style={{
        background: 'var(--tf-surface)',
        border: '1px solid var(--tf-border)',
        borderRadius: 10,
        padding: '18px 20px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Glow decorativo — canto superior direito */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: glowColor[variant],
          filter: 'blur(30px)',
          opacity: 0.12,
          pointerEvents: 'none',
        }}
      />

      {/* Ícone */}
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 8,
          marginBottom: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          ...iconStyle[variant],
        }}
      >
        <Icon size={17} />
      </div>

      {/* Valor */}
      <div
        style={{
          fontSize: 28,
          fontWeight: 600,
          color: valueColor[variant],
          lineHeight: 1,
          letterSpacing: '-0.5px',
        }}
      >
        {value}
      </div>

      {/* Título */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--tf-muted, var(--tf-txt3))',
          marginTop: 5,
        }}
      >
        {title}
      </div>

      {/* Descrição opcional */}
      {description && (
        <p style={{ fontSize: 11, color: 'var(--tf-txt3)', margin: '3px 0 0' }}>
          {description}
        </p>
      )}
    </div>
  )
}
