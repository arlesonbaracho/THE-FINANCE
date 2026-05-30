import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'

async function fetchPeriodData(tenantId: string, start: Date, end: Date) {
  const [pedidos, cmvAgg] = await Promise.all([
    prisma.pedido.findMany({
      where: { tenantId, status: 'FINALIZADO', criadoEm: { gte: start, lte: end } },
      include: {
        itens: {
          include: { product: { select: { name: true } } },
        },
      },
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
  const cmv = cmvAgg._sum.totalCost ?? 0
  const margem = totalVendas - cmv
  const margemPct = totalVendas > 0 ? (margem / totalVendas) * 100 : 0

  // Best product
  const productCount = new Map<string, { nome: string; total: number }>()
  for (const p of pedidos) {
    for (const item of p.itens) {
      const cur = productCount.get(item.productId) ?? { nome: item.product.name, total: 0 }
      cur.total += item.quantidade
      productCount.set(item.productId, cur)
    }
  }
  const produtoMaisVendido = Array.from(productCount.values()).sort((a, b) => b.total - a.total)[0]?.nome ?? '—'

  // Best day
  const dayMap = new Map<string, number>()
  for (const p of pedidos) {
    const k = p.criadoEm.toISOString().split('T')[0]
    dayMap.set(k, (dayMap.get(k) ?? 0) + p.total)
  }
  const diaMaisVendas = Array.from(dayMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

  // Peak hour
  const hourMap = new Map<number, number>()
  for (const p of pedidos) {
    const h = p.criadoEm.getHours()
    hourMap.set(h, (hourMap.get(h) ?? 0) + 1)
  }
  const horarioPico = Array.from(hourMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0

  // Chart series (by day-of-week: 0=Sun...6=Sat)
  const dowMap = new Map<number, { total: number; count: number }>()
  for (const p of pedidos) {
    const dow = p.criadoEm.getDay()
    const cur = dowMap.get(dow) ?? { total: 0, count: 0 }
    cur.total += p.total
    cur.count++
    dowMap.set(dow, cur)
  }
  const chartData = [0, 1, 2, 3, 4, 5, 6].map((dow) => ({
    dow,
    total: dowMap.get(dow)?.total ?? 0,
  }))

  return { totalVendas, numPedidos, ticketMedio, cmv, margem, margemPct, produtoMaisVendido, diaMaisVendas, horarioPico: `${horarioPico}h`, chartData }
}

export async function GET(req: Request) {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  const url = new URL(req.url)
  const p = url.searchParams

  const p1Start = new Date(p.get('startDate1') ?? new Date().toISOString().split('T')[0])
  const p1End = new Date(p.get('endDate1') ?? new Date().toISOString().split('T')[0])
  const p2Start = new Date(p.get('startDate2') ?? new Date().toISOString().split('T')[0])
  const p2End = new Date(p.get('endDate2') ?? new Date().toISOString().split('T')[0])

  p1Start.setHours(0, 0, 0, 0); p1End.setHours(23, 59, 59, 999)
  p2Start.setHours(0, 0, 0, 0); p2End.setHours(23, 59, 59, 999)

  const [d1, d2] = await Promise.all([
    fetchPeriodData(tenantId, p1Start, p1End),
    fetchPeriodData(tenantId, p2Start, p2End),
  ])

  function delta(a: number, b: number) {
    return { diferenca: a - b, variacao: b > 0 ? ((a - b) / b) * 100 : a > 0 ? 100 : 0 }
  }

  const metricas = [
    { metrica: 'Total vendas (R$)', p1: d1.totalVendas, p2: d2.totalVendas, ...delta(d1.totalVendas, d2.totalVendas) },
    { metrica: 'Nº de pedidos', p1: d1.numPedidos, p2: d2.numPedidos, ...delta(d1.numPedidos, d2.numPedidos) },
    { metrica: 'Ticket médio (R$)', p1: d1.ticketMedio, p2: d2.ticketMedio, ...delta(d1.ticketMedio, d2.ticketMedio) },
    { metrica: 'CMV (R$)', p1: d1.cmv, p2: d2.cmv, ...delta(d1.cmv, d2.cmv) },
    { metrica: 'Margem bruta (R$)', p1: d1.margem, p2: d2.margem, ...delta(d1.margem, d2.margem) },
    { metrica: 'Margem bruta (%)', p1: d1.margemPct, p2: d2.margemPct, ...delta(d1.margemPct, d2.margemPct) },
    { metrica: 'Produto mais vendido', p1: d1.produtoMaisVendido, p2: d2.produtoMaisVendido, diferenca: null, variacao: null },
    { metrica: 'Dia com mais vendas', p1: d1.diaMaisVendas, p2: d2.diaMaisVendas, diferenca: null, variacao: null },
    { metrica: 'Horário de pico', p1: d1.horarioPico, p2: d2.horarioPico, diferenca: null, variacao: null },
  ]

  return NextResponse.json({ metricas, periodo1Charts: d1.chartData, periodo2Charts: d2.chartData })
}
