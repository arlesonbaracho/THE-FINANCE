import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon: LucideIcon
  variant?: 'default' | 'warning' | 'success' | 'danger'
}

const variantStyles = {
  default: {
    icon: 'bg-blue-500/10 text-blue-400',
    value: 'text-white',
  },
  warning: {
    icon: 'bg-yellow-500/10 text-yellow-400',
    value: 'text-yellow-400',
  },
  success: {
    icon: 'bg-green-500/10 text-green-400',
    value: 'text-green-400',
  },
  danger: {
    icon: 'bg-red-500/10 text-red-400',
    value: 'text-red-400',
  },
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  variant = 'default',
}: StatCardProps) {
  const styles = variantStyles[variant]

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-zinc-400 font-medium">{title}</p>
            <p className={cn('text-3xl font-bold', styles.value)}>{value}</p>
            {description && (
              <p className="text-xs text-zinc-500">{description}</p>
            )}
          </div>
          <div className={cn('p-3 rounded-xl', styles.icon)}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
