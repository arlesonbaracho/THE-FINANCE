import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'

export async function GET() {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [pedidosHoje, pedidosAbertos] = await Promise.all([
      prisma.pedido.findMany({
        where: { tenantId, status: 'FINALIZADO', fechadoEm: { gte: today } },
        select: { total: true, garcomId: true },
      }),
      prisma.pedido.count({
        where: { tenantId, status: { in: ['ABERTO', 'EM_PREPARO', 'PRONTO'] } },
      }),
    ])

    const totalVendas = pedidosHoje.reduce((s, p) => s + p.total, 0)
    const totalPedidos = pedidosHoje.length
    const ticketMedio = totalPedidos > 0 ? totalVendas / totalPedidos : 0

    // CMV
    const movs = await prisma.ingredientMovement.findMany({
      where: { tenantId, type: 'OUT', createdAt: { gte: today } },
      select: { totalCost: true },
    })
    const cmvTotal = movs.reduce((s, m) => s + (m.totalCost ?? 0), 0)
    const cmvPercentual = totalVendas > 0 ? (cmvTotal / totalVendas) * 100 : 0

    // Produto mais vendido
    const itens = await prisma.pedidoItem.findMany({
      where: { pedido: { tenantId, status: 'FINALIZADO', fechadoEm: { gte: today } } },
      select: { productId: true, quantidade: true, product: { select: { name: true } } },
    })
    const porProduto: Record<string, { nome: string; qtd: number }> = {}
    for (const item of itens) {
      if (!porProduto[item.productId]) {
        porProduto[item.productId] = { nome: item.product.name, qtd: 0 }
      }
      porProduto[item.productId].qtd += item.quantidade
    }
    const maisVendido =
      Object.values(porProduto).sort((a, b) => b.qtd - a.qtd)[0] ?? null

    // Operador com mais pedidos
    const porOperador: Record<string, number> = {}
    for (const p of pedidosHoje) {
      if (!p.garcomId) continue
      porOperador[p.garcomId] = (porOperador[p.garcomId] ?? 0) + 1
    }
    const topOperadorId =
      Object.entries(porOperador).sort(([, a], [, b]) => b - a)[0]?.[0]
    const topOperador = topOperadorId
      ? await prisma.user.findFirst({
          where: { id: topOperadorId },
          select: { name: true },
        })
      : null

    // Variação vs semana passada
    const seteDiasAtras = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    const fimSeteDias = new Date(seteDiasAtras.getTime() + 24 * 60 * 60 * 1000)
    const snapshotSemanaPassada = await prisma.dashboardSnapshot.findFirst({
      where: { tenantId, data: { gte: seteDiasAtras, lt: fimSeteDias } },
      select: { totalVendas: true, ticketMedio: true },
    })

    const variacaoVendas =
      snapshotSemanaPassada && Number(snapshotSemanaPassada.totalVendas) > 0
        ? ((totalVendas - Number(snapshotSemanaPassada.totalVendas)) /
            Number(snapshotSemanaPassada.totalVendas)) *
          100
        : null
    const variacaoTicket =
      snapshotSemanaPassada && Number(snapshotSemanaPassada.ticketMedio) > 0
        ? ((ticketMedio - Number(snapshotSemanaPassada.ticketMedio)) /
            Number(snapshotSemanaPassada.ticketMedio)) *
          100
        : null

    return NextResponse.json({
      totalVendas,
      totalPedidos,
      pedidosAbertos,
      ticketMedio,
      cmvTotal,
      cmvPercentual,
      benchmark: parseFloat(process.env.DEFAULT_CMV_BENCHMARK ?? '35'),
      maisVendido,
      topOperador: topOperador?.name ?? null,
      variacaoVendas,
      variacaoTicket,
    })
  } catch (error) {
    console.error('[dashboard/kpis]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
