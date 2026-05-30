import { prisma } from '@/lib/prisma'

export async function processDashboardSnapshot(): Promise<void> {
  const tenants = await prisma.tenant.findMany({
    where: { active: true, deletedAt: null },
    select: { id: true },
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (const { id: tenantId } of tenants) {
    try {
      const pedidos = await prisma.pedido.findMany({
        where: { tenantId, status: 'FINALIZADO', fechadoEm: { gte: today } },
        select: { total: true, itens: { select: { productId: true, quantidade: true } } },
      })

      if (pedidos.length === 0) continue

      const totalVendas = pedidos.reduce((s, p) => s + p.total, 0)
      const totalPedidos = pedidos.length
      const ticketMedio = totalVendas / totalPedidos

      const movs = await prisma.ingredientMovement.findMany({
        where: { tenantId, type: 'OUT', createdAt: { gte: today } },
        select: { totalCost: true },
      })
      const cmvTotal = movs.reduce((s, m) => s + (m.totalCost ?? 0), 0)
      const cmvPercentual = totalVendas > 0 ? (cmvTotal / totalVendas) * 100 : 0

      const contagemProdutos: Record<string, number> = {}
      for (const pedido of pedidos) {
        for (const item of pedido.itens) {
          contagemProdutos[item.productId] = (contagemProdutos[item.productId] ?? 0) + item.quantidade
        }
      }
      const produtoMaisVendidoId = Object.entries(contagemProdutos)
        .sort(([, a], [, b]) => b - a)[0]?.[0] ?? null

      await prisma.dashboardSnapshot.upsert({
        where: { tenantId_data: { tenantId, data: today } },
        create: {
          tenantId, data: today,
          totalVendas, totalPedidos, ticketMedio, cmvTotal, cmvPercentual,
          produtoMaisVendidoId,
        },
        update: {
          totalVendas, totalPedidos, ticketMedio, cmvTotal, cmvPercentual,
          produtoMaisVendidoId,
        },
      })
    } catch (err) {
      console.error(`[snapshot] Failed for tenant ${tenantId}:`, err)
    }
  }
}
