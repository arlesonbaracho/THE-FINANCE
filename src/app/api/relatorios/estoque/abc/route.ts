import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'

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

  const [grouped, ingredients] = await Promise.all([
    prisma.ingredientMovement.groupBy({
      by: ['ingredientId'],
      where: {
        tenantId,
        type: { in: ['OUT', 'LOSS', 'EXPIRY', 'INTERNAL_USE'] },
        createdAt: { gte: start, lte: end },
      },
      _sum: { totalCost: true, quantity: true },
      orderBy: { _sum: { totalCost: 'desc' } },
    }),
    prisma.ingredient.findMany({
      where: { tenantId },
      select: { id: true, name: true, unit: true },
    }),
  ])

  const ingMap = new Map(ingredients.map((i) => [i.id, i]))
  const total = grouped.reduce((s, g) => s + (g._sum.totalCost ?? 0), 0)

  let accumulated = 0
  const itens = grouped.map((g) => {
    const valor = g._sum.totalCost ?? 0
    const pctTotal = total > 0 ? (valor / total) * 100 : 0
    accumulated += pctTotal
    const classe = accumulated <= 80 ? 'A' : accumulated <= 95 ? 'B' : 'C'
    const ing = ingMap.get(g.ingredientId)
    return {
      ingredientId: g.ingredientId,
      nome: ing?.name ?? g.ingredientId,
      unit: ing?.unit ?? '',
      qtdConsumida: g._sum.quantity ?? 0,
      valorConsumido: valor,
      pctTotal,
      pctAcumulado: Math.min(100, accumulated),
      classe,
    }
  })

  return NextResponse.json({ itens, total })
}
