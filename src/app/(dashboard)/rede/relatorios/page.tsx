'use client'

import { useEffect, useState } from 'react'
import { BenchmarkTable } from '@/components/multi-unit/BenchmarkTable'
import type { BenchmarkData } from '@/services/multi-unit/types'

const DIAS_OPTIONS = [7, 30, 90]

export default function RedeRelatoriosPage() {
  const [dias, setDias] = useState(30)
  const [benchmark, setBenchmark] = useState<BenchmarkData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/rede/relatorios/benchmark?days=${dias}`)
      .then((r) => r.json())
      .then((d: BenchmarkData) => { setBenchmark(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [dias])

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tf-txt)', margin: 0 }}>
          Relatórios da Rede
        </h1>
        <div style={{ display: 'flex', gap: 6 }}>
          {DIAS_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDias(d)}
              style={{
                padding: '4px 12px',
                borderRadius: 6,
                border: '1px solid var(--tf-border)',
                background: dias === d ? 'var(--tf-primary, #6366f1)' : 'transparent',
                color: dias === d ? '#fff' : 'var(--tf-txt)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--tf-txt)', marginBottom: 12 }}>
        Benchmark de Unidades
      </h2>

      {loading && (
        <p style={{ color: 'var(--tf-txt3)', fontSize: 13 }}>Carregando benchmark...</p>
      )}

      {!loading && benchmark && benchmark.unidades.length > 0 && (
        <BenchmarkTable
          unidades={benchmark.unidades}
          mediaCmv={benchmark.mediaCmv}
          mediaTicket={benchmark.mediaTicket}
          mediaMargem={benchmark.mediaMargem}
        />
      )}

      {!loading && benchmark && benchmark.unidades.length === 0 && (
        <div
          style={{
            background: 'var(--tf-surface)',
            border: '1px solid var(--tf-border)',
            borderRadius: 12,
            padding: 32,
            textAlign: 'center',
            color: 'var(--tf-txt3)',
            fontSize: 13,
          }}
        >
          Nenhuma unidade com dados no período selecionado.
        </div>
      )}
    </div>
  )
}
