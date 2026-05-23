import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'

export async function GET() {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  try {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const [ingredients, recentMovements] = await Promise.all([
      prisma.ingredient.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          unit: true,
          currentQty: true,
          minimumQty: true,
          pontoReposicao: true,
          custoMedioPonderado: true,
          dataValidade: true,
        },
      }),
      prisma.ingredientMovement.groupBy({
        by: ['type'],
        where: { tenantId, createdAt: { gte: thirtyDaysAgo } },
        _sum: { quantity: true, totalCost: true },
      }),
    ])

    let totalValue = 0
    let critical = 0
    let low = 0
    let expiring = 0
    let expired = 0

    for (const ing of ingredients) {
      totalValue += ing.currentQty * ing.custoMedioPonderado

      if (ing.currentQty <= 0 || ing.currentQty <= ing.minimumQty) critical++
      else if (ing.currentQty <= ing.pontoReposicao) low++

      if (ing.dataValidade) {
        if (ing.dataValidade < now) expired++
        else if (ing.dataValidade <= sevenDays) expiring++
      }
    }

    const inMovements = recentMovements.find((m) => m.type === 'IN')
    const outMovements = recentMovements.filter((m) =>
      ['OUT', 'LOSS', 'EXPIRY', 'INTERNAL_USE'].includes(m.type)
    )
    const totalOut = outMovements.reduce((acc, m) => acc + (m._sum.quantity ?? 0), 0)
    const totalIn = inMovements?._sum.quantity ?? 0
    const totalCostIn = inMovements?._sum.totalCost ?? 0

    // Upcoming expiry items
    const expiringItems = ingredients
      .filter((i) => i.dataValidade && i.dataValidade >= now && i.dataValidade <= thirtyDays)
      .map((i) => ({ id: i.id, name: i.name, dataValidade: i.dataValidade, currentQty: i.currentQty, unit: i.unit }))
      .sort((a, b) => (a.dataValidade?.getTime() ?? 0) - (b.dataValidade?.getTime() ?? 0))
      .slice(0, 10)

    return NextResponse.json({
      totalIngredients: ingredients.length,
      totalValue: Math.round(totalValue * 100) / 100,
      critical,
      low,
      expiring,
      expired,
      movements30d: { in: totalIn, out: totalOut, costIn: totalCostIn },
      expiringItems,
    })
  } catch (error) {
    console.error('[ESTOQUE DASHBOARD]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
