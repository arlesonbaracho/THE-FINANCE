'use client'

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const HORAS = Array.from({ length: 18 }, (_, i) => i + 6) // 6h–23h

type Cell = { media: number; pedidos: number }
type HeatmapData = Cell[][] // [7][24]

function heatColor(intensity: number): string {
  const lightness = Math.round(100 - intensity * 60)
  return `hsl(142, 70%, ${lightness}%)`
}

export function WeeklyHeatmap({ data }: { data: HeatmapData }) {
  const allValues = data.flatMap((row) => row.map((c) => c.media))
  const max = Math.max(...allValues, 1) // avoid division by zero

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)' }}
    >
      <p className="text-sm font-semibold mb-4" style={{ color: 'var(--tf-txt)' }}>
        Mapa de calor semanal — últimos 30 dias
      </p>
      <div style={{ overflowX: 'auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `40px repeat(7, 1fr)`,
            gap: 2,
            minWidth: 420,
          }}
        >
          {/* Header row */}
          <div />
          {DIAS.map((d) => (
            <div
              key={d}
              style={{
                textAlign: 'center',
                fontSize: 11,
                color: 'var(--tf-txt3)',
                fontWeight: 600,
                paddingBottom: 4,
              }}
            >
              {d}
            </div>
          ))}

          {/* Data rows */}
          {HORAS.map((hora) => (
            <>
              <div
                key={`h${hora}`}
                style={{
                  fontSize: 10,
                  color: 'var(--tf-txt3)',
                  textAlign: 'right',
                  paddingRight: 6,
                  lineHeight: '20px',
                }}
              >
                {String(hora).padStart(2, '0')}h
              </div>
              {DIAS.map((_, dia) => {
                const cell = data[dia]?.[hora] ?? { media: 0, pedidos: 0 }
                const intensity = cell.media / max
                return (
                  <div
                    key={`${dia}-${hora}`}
                    title={`${DIAS[dia]} às ${hora}h — média ${cell.media > 0 ? cell.media.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0'} (${cell.pedidos} pedidos)`}
                    style={{
                      height: 20,
                      borderRadius: 3,
                      backgroundColor:
                        cell.media > 0
                          ? heatColor(intensity)
                          : 'var(--tf-surface2)',
                      cursor: 'default',
                    }}
                  />
                )
              })}
            </>
          ))}
        </div>
      </div>
    </div>
  )
}
