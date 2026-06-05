import { prisma } from '@/lib/prisma'
import type { FiltroPeriodo, BenchmarkData, BenchmarkUnidade } from './types'

export async function vendasConsolidadas(brandId: string, periodo: FiltroPeriodo) {
  const tenants = await prisma.tenant.findMany({ where: { brandId }, select: { id: true } })
  const ids = tenants.map((t) => t.id)

  return prisma.dashboardSnapshot.findMany({
    where: { tenantId: { in: ids }, data: { gte: periodo.inicio, lte: periodo.fim } },
    orderBy: { data: 'asc' },
  })
}

export async function cmvConsolidado(brandId: string, periodo: FiltroPeriodo) {
  const snapshots = await vendasConsolidadas(brandId, periodo)
  const totalVendas = snapshots.reduce((s, r) => s + Number(r.totalVendas), 0)
  const totalCmv = snapshots.reduce((s, r) => s + Number(r.cmvTotal), 0)
  return {
    totalVendas,
    totalCmv,
    cmvPercentual: totalVendas > 0 ? (totalCmv / totalVendas) * 100 : 0,
  }
}

export async function benchmarkUnidades(brandId: string, periodo: FiltroPeriodo): Promise<BenchmarkData> {
  const tenants = await prisma.tenant.findMany({
    where: { brandId },
    select: { id: true, name: true },
  })

  if (tenants.length === 0) {
    return { unidades: [], mediaCmv: 0, mediaTicket: 0, mediaMargem: 0 }
  }

  const ids = tenants.map((t) => t.id)
  const snapshots = await prisma.dashboardSnapshot.findMany({
    where: { tenantId: { in: ids }, data: { gte: periodo.inicio, lte: periodo.fim } },
  })

  // Agregar por unidade
  const aggMap = new Map<string, { vendas: number; pedidos: number; cmvSum: number; days: number }>()
  for (const s of snapshots) {
    const cur = aggMap.get(s.tenantId) ?? { vendas: 0, pedidos: 0, cmvSum: 0, days: 0 }
    cur.vendas += Number(s.totalVendas)
    cur.pedidos += s.totalPedidos
    cur.cmvSum += Number(s.cmvPercentual)
    cur.days += 1
    aggMap.set(s.tenantId, cur)
  }

  const unidadesRaw = tenants.map((t) => {
    const agg = aggMap.get(t.id)
    const vendas = agg?.vendas ?? 0
    const pedidos = agg?.pedidos ?? 0
    const cmvPercent = agg && agg.days > 0 ? agg.cmvSum / agg.days : 0
    const ticketMedio = pedidos > 0 ? vendas / pedidos : 0
    const margemBruta = 100 - cmvPercent
    return { tenantId: t.id, tenantName: t.name, ticketMedio, cmvPercent, margemBruta }
  })

  const mediaCmv = unidadesRaw.reduce((s, u) => s + u.cmvPercent, 0) / unidadesRaw.length
  const mediaTicket = unidadesRaw.reduce((s, u) => s + u.ticketMedio, 0) / unidadesRaw.length
  const mediaMargem = unidadesRaw.reduce((s, u) => s + u.margemBruta, 0) / unidadesRaw.length

  const minCmv = Math.min(...unidadesRaw.map((u) => u.cmvPercent))
  const maxTicket = Math.max(...unidadesRaw.map((u) => u.ticketMedio))
  const maxMargem = Math.max(...unidadesRaw.map((u) => u.margemBruta))

  const unidades: BenchmarkUnidade[] = unidadesRaw.map((u) => ({
    ...u,
    liderCmv: u.cmvPercent === minCmv,
    liderTicket: u.ticketMedio === maxTicket,
    liderMargem: u.margemBruta === maxMargem,
    abaixoDaMedia: u.ticketMedio < mediaTicket * 0.8,
  }))

  return { unidades, mediaCmv, mediaTicket, mediaMargem }
}
