'use client'

import type { BenchmarkUnidade } from '@/services/multi-unit/types'

interface BenchmarkTableProps {
  unidades: BenchmarkUnidade[]
  mediaCmv: number
  mediaTicket: number
  mediaMargem: number
}

export function BenchmarkTable({ unidades, mediaCmv, mediaTicket, mediaMargem }: BenchmarkTableProps) {
  const th: React.CSSProperties = {
    textAlign: 'left',
    padding: '10px 14px',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--tf-txt3)',
    borderBottom: '1px solid var(--tf-border)',
    whiteSpace: 'nowrap',
  }
  const td: React.CSSProperties = {
    padding: '10px 14px',
    fontSize: 13,
    color: 'var(--tf-txt)',
    borderBottom: '1px solid var(--tf-border)',
  }

  function LiderBadge({ show }: { show: boolean }) {
    if (!show) return null
    return (
      <span
        style={{
          marginLeft: 6,
          fontSize: 10,
          background: '#10b981',
          color: '#fff',
          borderRadius: 4,
          padding: '1px 6px',
        }}
      >
        Líder
      </span>
    )
  }

  return (
    <div
      style={{
        background: 'var(--tf-surface)',
        border: '1px solid var(--tf-border)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Unidade</th>
            <th style={th}>CMV %</th>
            <th style={th}>Ticket Médio</th>
            <th style={th}>Margem Bruta %</th>
            <th style={th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {unidades.map((u) => (
            <tr key={u.tenantId}>
              <td style={td}>{u.tenantName}</td>
              <td style={td}>
                {u.cmvPercent.toFixed(1)}%
                <LiderBadge show={u.liderCmv} />
              </td>
              <td style={td}>
                R$ {u.ticketMedio.toFixed(2)}
                <LiderBadge show={u.liderTicket} />
              </td>
              <td style={td}>
                {u.margemBruta.toFixed(1)}%
                <LiderBadge show={u.liderMargem} />
              </td>
              <td style={td}>
                {u.abaixoDaMedia && (
                  <span
                    style={{
                      fontSize: 11,
                      background: '#f59e0b',
                      color: '#fff',
                      borderRadius: 4,
                      padding: '2px 8px',
                    }}
                  >
                    Abaixo da média
                  </span>
                )}
              </td>
            </tr>
          ))}
          {/* Linha de média */}
          <tr style={{ background: 'var(--tf-surface-hover, rgba(0,0,0,0.03))' }}>
            <td style={{ ...td, fontWeight: 600, color: 'var(--tf-txt3)' }}>Média da rede</td>
            <td style={{ ...td, color: 'var(--tf-txt3)' }}>{mediaCmv.toFixed(1)}%</td>
            <td style={{ ...td, color: 'var(--tf-txt3)' }}>R$ {mediaTicket.toFixed(2)}</td>
            <td style={{ ...td, color: 'var(--tf-txt3)' }}>{mediaMargem.toFixed(1)}%</td>
            <td style={td} />
          </tr>
        </tbody>
      </table>
    </div>
  )
}
