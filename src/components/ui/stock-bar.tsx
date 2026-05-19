interface StockBarProps {
  current: number
  minimum: number
  width?: number
}

export function StockBar({ current, minimum, width = 80 }: StockBarProps) {
  const coverage = minimum > 0 ? Math.min((current / minimum) * 100, 100) : 100
  const color =
    coverage >= 60 ? 'var(--tf-green-ok)' :
    coverage >= 20 ? 'var(--tf-yellow)' :
    'var(--tf-red)'

  return (
    <div
      style={{
        width,
        height: 3,
        borderRadius: 2,
        background: 'var(--tf-border-color)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${coverage}%`,
          height: '100%',
          borderRadius: 2,
          background: color,
          transition: 'width 0.2s',
        }}
      />
    </div>
  )
}
