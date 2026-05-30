'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AlertTriangle, TrendingDown, Settings2, Info } from 'lucide-react'

type Alert = {
  id: string
  tipo: string
  severidade: string
  titulo: string
  criadoEm: string
  metadata: Record<string, unknown>
}

const TIPO_ICON: Record<string, React.ReactNode> = {
  ESTOQUE: <AlertTriangle className="w-4 h-4" />,
  FINANCEIRO: <TrendingDown className="w-4 h-4" />,
  OPERACIONAL: <Settings2 className="w-4 h-4" />,
  SISTEMA: <Info className="w-4 h-4" />,
}

const SEV_COLOR: Record<string, string> = {
  CRITICA: 'var(--tf-red)',
  ALTA: '#f97316',
  MEDIA: '#eab308',
  BAIXA: 'var(--tf-txt3)',
  INFO: '#22c55e',
}

export function AlertsHighlight() {
  const { data } = useQuery<{ items: Alert[] }>({
    queryKey: ['alertas-highlight'],
    queryFn: () =>
      fetch('/api/alertas?status=NAO_LIDO&limit=3').then((r) => r.json()),
    staleTime: 60_000,
  })

  const items = data?.items ?? []
  if (items.length === 0) return null

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-red-bd)' }}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: 'var(--tf-txt)' }}>
          Alertas críticos
        </p>
        <Link href="/alertas" style={{ fontSize: 12, color: 'var(--tf-txt3)' }}>
          Ver todos →
        </Link>
      </div>
      {items.map((a) => (
        <div key={a.id} className="flex items-start gap-2">
          <span
            className="flex-shrink-0 mt-0.5"
            style={{ color: SEV_COLOR[a.severidade] ?? 'var(--tf-txt3)' }}
          >
            {TIPO_ICON[a.tipo] ?? <Info className="w-4 h-4" />}
          </span>
          <div className="min-w-0">
            <p className="text-sm" style={{ color: 'var(--tf-txt)' }}>
              {a.titulo}
            </p>
            <p style={{ fontSize: 11, color: 'var(--tf-txt3)' }}>
              {formatDistanceToNow(new Date(a.criadoEm), {
                addSuffix: true,
                locale: ptBR,
              })}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
