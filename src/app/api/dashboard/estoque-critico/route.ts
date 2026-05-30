import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'

export async function GET() {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  try {
    // Prisma doesn't support column-vs-column comparisons directly — filter in JS
    const todos = await prisma.ingredient.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        currentQty: true,
        minimumQty: true,
        unit: true,
      },
    })

    const insumos = todos
      .filter((i) => i.currentQty === 0 || i.currentQty < i.minimumQty)
      .sort((a, b) => a.currentQty - b.currentQty)
      .slice(0, 20)

    return NextResponse.json(insumos)
  } catch (error) {
    console.error('[dashboard/estoque-critico]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
