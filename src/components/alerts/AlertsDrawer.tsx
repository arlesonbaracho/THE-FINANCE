'use client'

import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { X, AlertTriangle, TrendingDown, Settings2, Info } from 'lucide-react'
import Link from 'next/link'

type Alert = {
  id: string
  tipo: string
  severidade: string
  titulo: string
  criadoEm: string
  metadata: Record<string, unknown>
}

const TIPO_ICON: Record<string, React.ReactNode> = {
  ESTOQUE: <AlertTriangle className="w-3.5 h-3.5" />,
  FINANCEIRO: <TrendingDown className="w-3.5 h-3.5" />,
  OPERACIONAL: <Settings2 className="w-3.5 h-3.5" />,
  SISTEMA: <Info className="w-3.5 h-3.5" />,
}

const SEV_COLOR: Record<string, string> = {
  CRITICA: 'var(--tf-red)',
  ALTA: '#f97316',
  MEDIA: '#eab308',
  BAIXA: 'var(--tf-txt3)',
  INFO: '#22c55e',
}

const ACAO_HREF: Record<string, string> = {
  'Lançar entrada': '/estoque/insumos',
  'Ver relatório CMV': '/relatorios',
  'Ver insumo': '/estoque/insumos',
  'Lançar baixa': '/estoque/insumos',
  'Ver cozinha': '/pdv',
  'Ver pedidos': '/pdv',
}

export function AlertsDrawer({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { data = [] } = useQuery<Alert[]>({
    queryKey: ['alerts-drawer'],
    queryFn: () =>
      fetch('/api/alertas?limit=5&status=NAO_LIDO')
        .then((r) => r.json())
        .then((d: { items?: Alert[] }) => d.items ?? []),
    staleTime: 60_000,
    enabled: open,
  })

  if (!open) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        className="fixed top-0 right-0 h-full w-80 z-50 flex flex-col"
        style={{
          background: 'var(--tf-surface)',
          borderLeft: '1px solid var(--tf-border)',
          boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: '1px solid var(--tf-border)' }}
        >
          <p className="font-semibold text-sm" style={{ color: 'var(--tf-txt)' }}>
            Alertas recentes
          </p>
          <button
            onClick={onClose}
            style={{
              color: 'var(--tf-txt3)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Alert list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {data.length === 0 && (
            <p
              style={{
                fontSize: 13,
                color: 'var(--tf-txt3)',
                textAlign: 'center',
                marginTop: 20,
              }}
            >
              Nenhum alerta não lido
            </p>
          )}
          {data.map((a) => {
            const acao = typeof a.metadata?.acao === 'string' ? a.metadata.acao : ''
            const href = ACAO_HREF[acao] ?? '/alertas'
            return (
              <div
                key={a.id}
                className="rounded-lg p-3 space-y-1"
                style={{
                  background: 'var(--tf-surface2)',
                  border: '1px solid var(--tf-border)',
                }}
              >
                <div className="flex items-center gap-2">
                  <span style={{ color: SEV_COLOR[a.severidade] ?? 'var(--tf-txt3)' }}>
                    {TIPO_ICON[a.tipo] ?? <Info className="w-3.5 h-3.5" />}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--tf-txt3)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {a.tipo}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--tf-txt)', lineHeight: 1.4 }}>
                  {a.titulo}
                </p>
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: 11, color: 'var(--tf-txt3)' }}>
                    {formatDistanceToNow(new Date(a.criadoEm), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </span>
                  {acao && (
                    <Link
                      href={href}
                      onClick={onClose}
                      style={{ fontSize: 11, color: 'var(--tf-green)', fontWeight: 600 }}
                    >
                      {acao} →
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="p-4" style={{ borderTop: '1px solid var(--tf-border)' }}>
          <Link
            href="/alertas"
            onClick={onClose}
            className="block text-center text-sm py-2 rounded-lg font-medium"
            style={{
              background: 'var(--tf-surface2)',
              color: 'var(--tf-txt2)',
              border: '1px solid var(--tf-border)',
            }}
          >
            Ver todos os alertas
          </Link>
        </div>
      </div>
    </>
  )
}
