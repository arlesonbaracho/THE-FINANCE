import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'

export async function GET() {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const seteDiasAtras = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    const fimSeteDias = new Date(seteDiasAtras.getTime() + 24 * 60 * 60 * 1000)

    const [pedidosHoje, snapshotSemanaPassada] = await Promise.all([
      prisma.pedido.findMany({
        where: { tenantId, status: 'FINALIZADO', fechadoEm: { gte: today } },
        select: { total: true, fechadoEm: true },
        orderBy: { fechadoEm: 'asc' },
      }),
      prisma.dashboardSnapshot.findFirst({
        where: { tenantId, data: { gte: seteDiasAtras, lt: fimSeteDias } },
        select: { totalVendas: true },
      }),
    ])

    // Accumulate by hour (0-23)
    const acumuladoPorHora: number[] = Array(24).fill(0)
    let acumulado = 0
    for (const p of pedidosHoje) {
      const hora = new Date(p.fechadoEm!).getHours()
      acumulado += p.total
      acumuladoPorHora[hora] = acumulado
    }
    // Forward-fill zeros (carry last known value forward)
    let ultimo = 0
    const diaAtual = acumuladoPorHora.map((v) => {
      if (v > 0) ultimo = v
      return ultimo
    })

    return NextResponse.json({
      diaAtual,
      semanaPassada: snapshotSemanaPassada
        ? Number(snapshotSemanaPassada.totalVendas)
        : null,
    })
  } catch (error) {
    console.error('[dashboard/grafico]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
