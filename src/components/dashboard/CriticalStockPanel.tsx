'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { CheckCircle, AlertTriangle } from 'lucide-react'

type Insumo = {
  id: string
  name: string
  currentQty: number
  minimumQty: number
  unit: string
}

export function CriticalStockPanel() {
  const { data = [], isLoading } = useQuery<Insumo[]>({
    queryKey: ['estoque-critico'],
    queryFn: () =>
      fetch('/api/dashboard/estoque-critico').then((r) => r.json()),
    staleTime: 300_000,
  })

  if (isLoading) {
    return (
      <div
        className="h-32 animate-pulse rounded-xl"
        style={{ background: 'var(--tf-surface2)' }}
      />
    )
  }

  if (data.length === 0) {
    return (
      <div
        className="rounded-xl p-4 flex items-center gap-3"
        style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)' }}
      >
        <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#22c55e' }} />
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--tf-txt)' }}>
            Estoque normalizado
          </p>
          <p style={{ fontSize: 11, color: 'var(--tf-txt3)' }}>
            Nenhum insumo abaixo do mínimo
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)' }}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" style={{ color: 'var(--tf-red)' }} />
        <p className="text-sm font-semibold" style={{ color: 'var(--tf-txt)' }}>
          Estoque crítico
        </p>
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {data.map((i) => (
          <div key={i.id} className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p
                className="text-sm truncate"
                style={{ color: 'var(--tf-txt)' }}
                title={i.name}
              >
                {i.name}
              </p>
              <p style={{ fontSize: 11, color: 'var(--tf-txt3)' }}>
                {i.currentQty} {i.unit} · mín. {i.minimumQty}
              </p>
            </div>
            <Link
              href={`/estoque/insumos?id=${i.id}`}
              className="flex-shrink-0 px-3 py-1 rounded-lg text-xs font-medium"
              style={{
                background: 'var(--tf-surface2)',
                color: 'var(--tf-txt2)',
                border: '1px solid var(--tf-border)',
              }}
            >
              Entrada
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
