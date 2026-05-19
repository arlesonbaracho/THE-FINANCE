import { LucideIcon } from 'lucide-react'

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

export function StatCard({ title, value, description, icon: Icon, variant = 'default' }: StatCardProps) {
  return (
    <div
      style={{
        background: 'var(--tf-surface)',
        border: '1px solid var(--tf-border)',
        borderRadius: 8,
        padding: '16px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          ...iconStyle[variant],
        }}
      >
        <Icon size={18} />
      </div>
      <div>
        <p
          style={{
            fontSize: 10,
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
            color: 'var(--tf-txt3)',
            margin: 0,
          }}
        >
          {title}
        </p>
        <p
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: valueColor[variant],
            margin: '2px 0 0',
            lineHeight: 1.2,
          }}
        >
          {value}
        </p>
        {description && (
          <p style={{ fontSize: 11, color: 'var(--tf-txt3)', margin: '2px 0 0' }}>
            {description}
          </p>
        )}
      </div>
    </div>
  )
}
