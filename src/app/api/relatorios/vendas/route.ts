import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'

function dayKey(d: Date) {
  return d.toISOString().split('T')[0]
}

function parseRange(startStr: string | null, endStr: string | null) {
  const start = startStr ? new Date(startStr) : new Date(new Date().setHours(0, 0, 0, 0))
  const end = endStr ? new Date(endStr) : new Date(new Date().setHours(23, 59, 59, 999))
  start.setHours(0, 0, 0, 0)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

async function fetchKpis(tenantId: string, start: Date, end: Date) {
  const [pedidos, cmvAgg] = await Promise.all([
    prisma.pedido.findMany({
      where: { tenantId, status: 'FINALIZADO', criadoEm: { gte: start, lte: end } },
      include: { itens: { include: { product: { include: { category: true } } } } },
    }),
    prisma.ingredientMovement.aggregate({
      where: {
        tenantId,
        type: { in: ['OUT', 'LOSS', 'EXPIRY', 'INTERNAL_USE'] },
        createdAt: { gte: start, lte: end },
      },
      _sum: { totalCost: true },
    }),
  ])

  const totalVendas = pedidos.reduce((s, p) => s + p.total, 0)
  const numPedidos = pedidos.length
  const ticketMedio = numPedidos > 0 ? totalVendas / numPedidos : 0
  const cmvTotal = cmvAgg._sum.totalCost ?? 0
  const cmvPct = totalVendas > 0 ? (cmvTotal / totalVendas) * 100 : 0

  // Group by day for chart
  const dailyMap = new Map<string, { pedidos: number; total: number }>()
  for (const p of pedidos) {
    const k = dayKey(p.criadoEm)
    const cur = dailyMap.get(k) ?? { pedidos: 0, total: 0 }
    cur.pedidos++
    cur.total += p.total
    dailyMap.set(k, cur)
  }

  // CMV movements by day
  const movsByDay = await prisma.ingredientMovement.groupBy({
    by: ['createdAt'],
    where: {
      tenantId,
      type: { in: ['OUT', 'LOSS', 'EXPIRY', 'INTERNAL_USE'] },
      createdAt: { gte: start, lte: end },
    },
    _sum: { totalCost: true },
  })
  const cmvByDay = new Map<string, number>()
  for (const m of movsByDay) {
    const k = dayKey(new Date(m.createdAt))
    cmvByDay.set(k, (cmvByDay.get(k) ?? 0) + (m._sum.totalCost ?? 0))
  }

  // Fill chart data for all days in range
  const chartData: { data: string; vendas: number; pedidos: number; ticketMedio: number; cmv: number }[] = []
  const cur = new Date(start)
  while (cur <= end) {
    const k = dayKey(cur)
    const day = dailyMap.get(k) ?? { pedidos: 0, total: 0 }
    chartData.push({
      data: k,
      vendas: day.total,
      pedidos: day.pedidos,
      ticketMedio: day.pedidos > 0 ? day.total / day.pedidos : 0,
      cmv: cmvByDay.get(k) ?? 0,
    })
    cur.setDate(cur.getDate() + 1)
  }

  // Category distribution
  const catMap = new Map<string, { nome: string; total: number }>()
  for (const p of pedidos) {
    for (const item of p.itens) {
      const catName = item.product.category?.name ?? 'Sem categoria'
      const val = catMap.get(catName) ?? { nome: catName, total: 0 }
      val.total += item.quantidade * item.precoUnitario
      catMap.set(catName, val)
    }
  }
  const categorias = Array.from(catMap.values()).sort((a, b) => b.total - a.total)
  const totalCat = categorias.reduce((s, c) => s + c.total, 0)
  const categoriasWithPct = categorias.map((c) => ({ ...c, pct: totalCat > 0 ? (c.total / totalCat) * 100 : 0 }))

  // Daily summary for table
  const resumoDiario = chartData.map((d) => ({
    data: d.data,
    pedidos: d.pedidos,
    total: d.vendas,
    ticketMedio: d.ticketMedio,
    cmv: d.cmv,
    margem: d.vendas > 0 ? ((d.vendas - d.cmv) / d.vendas) * 100 : 0,
  }))

  return { totalVendas, numPedidos, ticketMedio, cmvTotal, cmvPct, chartData, categorias: categoriasWithPct, resumoDiario }
}

export async function GET(req: Request) {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  const url = new URL(req.url)
  const { start, end } = parseRange(url.searchParams.get('startDate'), url.searchParams.get('endDate'))

  // Previous period (same number of days)
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1
  const prevEnd = new Date(start.getTime() - 86400000)
  const prevStart = new Date(prevEnd.getTime() - (daysDiff - 1) * 86400000)
  prevEnd.setHours(23, 59, 59, 999)

  const [current, previous] = await Promise.all([
    fetchKpis(tenantId, start, end),
    fetchKpis(tenantId, prevStart, prevEnd),
  ])

  function pct(cur: number, prev: number) {
    if (prev === 0) return cur > 0 ? 100 : 0
    return ((cur - prev) / prev) * 100
  }

  const variacaoAnterior = {
    totalVendas: pct(current.totalVendas, previous.totalVendas),
    numPedidos: pct(current.numPedidos, previous.numPedidos),
    ticketMedio: pct(current.ticketMedio, previous.ticketMedio),
    cmvTotal: pct(current.cmvTotal, previous.cmvTotal),
  }

  return NextResponse.json({
    kpis: {
      totalVendas: current.totalVendas,
      numPedidos: current.numPedidos,
      ticketMedio: current.ticketMedio,
      cmvTotal: current.cmvTotal,
      cmvPct: current.cmvPct,
    },
    variacaoAnterior,
    chartData: current.chartData,
    categorias: current.categorias,
    resumoDiario: current.resumoDiario,
  })
}
