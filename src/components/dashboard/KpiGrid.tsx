'use client'

import { TrendingUp, TrendingDown, ShoppingCart, DollarSign, BarChart2, Package, Users } from 'lucide-react'

type KpiData = {
  totalVendas: number
  totalPedidos: number
  pedidosAbertos: number
  ticketMedio: number
  cmvTotal: number
  cmvPercentual: number
  benchmark: number
  maisVendido: { nome: string; qtd: number } | null
  topOperador: string | null
  variacaoVendas: number | null
  variacaoTicket: number | null
}

function fmtCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function Variacao({ v }: { v: number | null }) {
  if (v == null) return null
  const up = v >= 0
  return (
    <span
      className="flex items-center gap-0.5 text-xs"
      style={{ color: up ? '#22c55e' : 'var(--tf-red)' }}
    >
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {Math.abs(v).toFixed(1)}%
    </span>
  )
}

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  variacao,
  warn,
}: {
  title: string
  value: string
  sub?: string
  icon: React.ElementType
  variacao?: number | null
  warn?: boolean
}) {
  return (
    <div
      className="rounded-xl p-4 space-y-2"
      style={{
        background: 'var(--tf-surface)',
        border: `1px solid ${warn ? 'var(--tf-red-bd)' : 'var(--tf-border)'}`,
      }}
    >
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 12, color: 'var(--tf-txt3)' }}>{title}</span>
        <Icon className="w-4 h-4" style={{ color: 'var(--tf-txt3)' }} />
      </div>
      <p
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: warn ? 'var(--tf-red)' : 'var(--tf-txt)',
          margin: 0,
          lineHeight: 1.2,
        }}
      >
        {value}
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        {sub && (
          <span style={{ fontSize: 11, color: 'var(--tf-txt3)' }}>{sub}</span>
        )}
        <Variacao v={variacao ?? null} />
      </div>
    </div>
  )
}

export function KpiGrid({ data }: { data: KpiData }) {
  const cmvWarn = data.cmvPercentual > data.benchmark

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        title="Vendas do dia"
        value={fmtCurrency(data.totalVendas)}
        icon={DollarSign}
        variacao={data.variacaoVendas}
      />
      <KpiCard
        title="Pedidos finalizados"
        value={String(data.totalPedidos)}
        icon={ShoppingCart}
      />
      <KpiCard
        title="Pedidos em aberto"
        value={String(data.pedidosAbertos)}
        sub={data.pedidosAbertos > 0 ? 'Em andamento' : undefined}
        icon={BarChart2}
      />
      <KpiCard
        title="Ticket médio"
        value={fmtCurrency(data.ticketMedio)}
        icon={TrendingUp}
        variacao={data.variacaoTicket}
      />
      <KpiCard
        title="CMV do dia"
        value={`${data.cmvPercentual.toFixed(1)}%`}
        sub={`${fmtCurrency(data.cmvTotal)} · benchmark ${data.benchmark}%`}
        icon={BarChart2}
        warn={cmvWarn}
      />
      <KpiCard
        title="Mais vendido"
        value={data.maisVendido?.nome ?? '—'}
        sub={data.maisVendido ? `${data.maisVendido.qtd} unidades` : undefined}
        icon={Package}
      />
      <KpiCard
        title="Operador destaque"
        value={data.topOperador ?? '—'}
        icon={Users}
      />
    </div>
  )
}
