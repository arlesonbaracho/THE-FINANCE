import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'

const DOW_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export async function GET(req: Request) {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  const url = new URL(req.url)
  const startStr = url.searchParams.get('startDate')
  const endStr = url.searchParams.get('endDate')
  const start = startStr ? new Date(startStr) : new Date(new Date().setHours(0, 0, 0, 0))
  const end = endStr ? new Date(endStr) : new Date(new Date().setHours(23, 59, 59, 999))
  start.setHours(0, 0, 0, 0)
  end.setHours(23, 59, 59, 999)

  const pedidos = await prisma.pedido.findMany({
    where: { tenantId, criadoEm: { gte: start, lte: end } },
    select: {
      id: true,
      status: true,
      criadoEm: true,
      fechadoEm: true,
      garcom: { select: { name: true } },
      itens: {
        select: {
          productId: true,
          quantidade: true,
          status: true,
          product: { select: { name: true } },
        },
      },
    },
  })

  // Prep time per product (using pedido criadoEm → fechadoEm)
  const prodTimeMap = new Map<string, { nome: string; totalMs: number; count: number }>()
  const turnoMap = new Map<string, { totalMs: number; count: number }>()

  // Heatmap: hour (6-23) × day-of-week (0-6)
  const heatmap: number[][] = Array.from({ length: 18 }, () => Array(7).fill(0))

  const cancelamentos: { data: string; operador: string; produtos: string[]; pedidoId: string }[] = []

  for (const p of pedidos) {
    const hour = p.criadoEm.getHours()
    const dow = p.criadoEm.getDay()
    const hi = hour >= 6 ? Math.min(hour - 6, 17) : 0
    heatmap[hi][dow]++

    if (p.status === 'CANCELADO') {
      cancelamentos.push({
        data: p.criadoEm.toISOString().split('T')[0],
        operador: p.garcom.name ?? '—',
        produtos: p.itens.map((i) => `${i.quantidade}× ${i.product.name}`),
        pedidoId: p.id,
      })
    }

    if (p.status === 'FINALIZADO' && p.fechadoEm) {
      const ms = p.fechadoEm.getTime() - p.criadoEm.getTime()
      if (ms > 0) {
        // Turno
        const turno = hour < 12 ? 'Manhã' : hour < 18 ? 'Tarde' : 'Noite'
        const cur = turnoMap.get(turno) ?? { totalMs: 0, count: 0 }
        cur.totalMs += ms; cur.count++
        turnoMap.set(turno, cur)

        // Per product
        for (const item of p.itens) {
          const t = prodTimeMap.get(item.productId) ?? { nome: item.product.name, totalMs: 0, count: 0 }
          t.totalMs += ms; t.count += item.quantidade
          prodTimeMap.set(item.productId, t)
        }
      }
    }
  }

  const finalizados = pedidos.filter((p) => p.status === 'FINALIZADO' && p.fechadoEm)
  const tempoMedioGeral = finalizados.length > 0
    ? finalizados.reduce((s, p) => s + (p.fechadoEm!.getTime() - p.criadoEm.getTime()), 0) / finalizados.length
    : 0

  const tempoMedioPorPrato = Array.from(prodTimeMap.entries())
    .map(([id, t]) => ({
      id,
      nome: t.nome,
      tempoMedioMs: t.count > 0 ? t.totalMs / t.count : 0,
      tempoMedioMin: t.count > 0 ? Math.round(t.totalMs / t.count / 60000) : 0,
    }))
    .sort((a, b) => a.tempoMedioMs - b.tempoMedioMs)

  const tempoMedioPorTurno = ['Manhã', 'Tarde', 'Noite'].map((turno) => {
    const t = turnoMap.get(turno) ?? { totalMs: 0, count: 0 }
    return { turno, tempoMedioMin: t.count > 0 ? Math.round(t.totalMs / t.count / 60000) : 0, pedidos: t.count }
  })

  const heatmapLabeled = heatmap.map((row, hi) => ({
    hora: `${hi + 6}h`,
    dias: row.map((count, dow) => ({ dow, label: DOW_LABELS[dow], count })),
  }))

  return NextResponse.json({
    tempoMedioGeralMin: Math.round(tempoMedioGeral / 60000),
    tempoMedioPorPrato,
    tempoMedioPorTurno,
    heatmap: heatmapLabeled,
    cancelamentos,
    totalPedidos: pedidos.length,
    totalCancelamentos: cancelamentos.length,
  })
}
