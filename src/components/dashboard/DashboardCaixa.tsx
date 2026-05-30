'use client'

import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Pedido = {
  id: string
  total: number
  mesa: { numero: number }
  fechadoEm?: string
  criadoEm?: string
}

type CaixaData = {
  pedidosAbertos: Pedido[]
  ultimosPedidos: Pedido[]
  totalSessao: number
  ticketMedio: number
}

function fmtCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function DashboardCaixa() {
  const { data: session } = useSession()
  const caixaId = session?.user?.id

  const { data, isLoading } = useQuery<CaixaData>({
    queryKey: ['dashboard-caixa', caixaId],
    queryFn: () =>
      fetch(`/api/dashboard/caixa?caixaId=${caixaId}`).then((r) => r.json()),
    enabled: !!caixaId,
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl animate-pulse"
            style={{ background: 'var(--tf-surface2)' }}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPIs da sessão */}
      <div className="grid grid-cols-2 gap-4">
        <div
          className="rounded-xl p-4"
          style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)' }}
        >
          <p style={{ fontSize: 12, color: 'var(--tf-txt3)' }}>Total da sessão</p>
          <p
            style={{ fontSize: 24, fontWeight: 700, color: 'var(--tf-txt)', marginTop: 4 }}
          >
            {fmtCurrency(data?.totalSessao ?? 0)}
          </p>
        </div>
        <div
          className="rounded-xl p-4"
          style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)' }}
        >
          <p style={{ fontSize: 12, color: 'var(--tf-txt3)' }}>Ticket médio</p>
          <p
            style={{ fontSize: 24, fontWeight: 700, color: 'var(--tf-txt)', marginTop: 4 }}
          >
            {fmtCurrency(data?.ticketMedio ?? 0)}
          </p>
        </div>
      </div>

      <Link
        href="/pdv"
        className="block w-full text-center py-3 rounded-xl font-semibold text-white"
        style={{ background: 'var(--tf-green)', fontSize: 15 }}
      >
        Abrir PDV →
      </Link>

      {/* Pedidos em aberto */}
      <div
        className="rounded-xl p-4 space-y-2"
        style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)' }}
      >
        <p className="text-sm font-semibold" style={{ color: 'var(--tf-txt)' }}>
          Pedidos em aberto
        </p>
        {(data?.pedidosAbertos ?? []).length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--tf-txt3)' }}>
            Nenhum pedido em aberto
          </p>
        ) : (
          (data?.pedidosAbertos ?? []).map((p) => (
            <Link
              key={p.id}
              href={`/pdv?pedido=${p.id}`}
              className="flex justify-between py-1"
            >
              <span style={{ fontSize: 13, color: 'var(--tf-txt)' }}>
                Mesa {p.mesa.numero}
              </span>
              <span style={{ fontSize: 13, color: 'var(--tf-txt2)' }}>
                {fmtCurrency(p.total)}
              </span>
            </Link>
          ))
        )}
      </div>

      {/* Últimos 5 pedidos */}
      {(data?.ultimosPedidos ?? []).length > 0 && (
        <div
          className="rounded-xl p-4 space-y-2"
          style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)' }}
        >
          <p className="text-sm font-semibold" style={{ color: 'var(--tf-txt)' }}>
            Últimos pedidos
          </p>
          {(data?.ultimosPedidos ?? []).map((p) => (
            <div key={p.id} className="flex justify-between items-center py-1">
              <div>
                <span style={{ fontSize: 13, color: 'var(--tf-txt)' }}>
                  Mesa {p.mesa.numero}
                </span>
                {p.fechadoEm && (
                  <span style={{ fontSize: 11, color: 'var(--tf-txt3)', marginLeft: 6 }}>
                    {formatDistanceToNow(new Date(p.fechadoEm), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 13, color: 'var(--tf-txt2)' }}>
                {fmtCurrency(p.total)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
