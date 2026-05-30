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

  const [ingredients, movements] = await Promise.all([
    prisma.ingredient.findMany({
      where: { tenantId },
      select: { id: true, name: true, codigoInterno: true, unit: true, currentQty: true },
    }),
    prisma.ingredientMovement.groupBy({
      by: ['ingredientId', 'type'],
      where: { tenantId, createdAt: { gte: start, lte: end } },
      _sum: { quantity: true, totalCost: true },
    }),
  ])

  const IN_TYPES = new Set(['IN'])
  const OUT_TYPES = new Set(['OUT', 'LOSS', 'EXPIRY', 'INTERNAL_USE'])

  const movMap = new Map<
    string,
    { entradas: number; saidas: number; custoEntradas: number; custoSaidas: number }
  >()

  for (const m of movements) {
    const cur = movMap.get(m.ingredientId) ?? { entradas: 0, saidas: 0, custoEntradas: 0, custoSaidas: 0 }
    if (IN_TYPES.has(m.type)) {
      cur.entradas += m._sum.quantity ?? 0
      cur.custoEntradas += m._sum.totalCost ?? 0
    } else if (OUT_TYPES.has(m.type)) {
      cur.saidas += m._sum.quantity ?? 0
      cur.custoSaidas += m._sum.totalCost ?? 0
    }
    movMap.set(m.ingredientId, cur)
  }

  const idsWithMovement = new Set(movMap.keys())

  const result = ingredients.map((ing) => {
    const mov = movMap.get(ing.id) ?? { entradas: 0, saidas: 0, custoEntradas: 0, custoSaidas: 0 }
    const estoqueFinal = ing.currentQty
    const estoqueInicial = Math.max(0, estoqueFinal + mov.saidas - mov.entradas)
    const estoqueMedia = (estoqueInicial + estoqueFinal) / 2
    const giro = estoqueMedia > 0 ? mov.saidas / estoqueMedia : mov.saidas > 0 ? 999 : 0
    const classificacao =
      !idsWithMovement.has(ing.id) || mov.saidas === 0
        ? 'Parado'
        : giro > 2
          ? 'Alta'
          : giro >= 0.5
            ? 'Média'
            : 'Baixa'
    return {
      id: ing.id,
      nome: ing.name,
      codigo: ing.codigoInterno,
      unit: ing.unit,
      estoqueInicial,
      entradas: mov.entradas,
      saidas: mov.saidas,
      estoqueFinal,
      custoEntradas: mov.custoEntradas,
      custoSaidas: mov.custoSaidas,
      giro: Math.round(giro * 100) / 100,
      classificacao,
      semMovimento: !idsWithMovement.has(ing.id),
    }
  })

  const semMovimento = result.filter((r) => r.semMovimento)
  const comMovimento = result.filter((r) => !r.semMovimento).sort((a, b) => b.giro - a.giro)

  return NextResponse.json({ itens: comMovimento, semMovimento })
}
