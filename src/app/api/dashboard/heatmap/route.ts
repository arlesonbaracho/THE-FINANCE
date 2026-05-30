import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'
import { redisConnection } from '@/lib/bullmq'

export async function GET(req: NextRequest) {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  try {
    const cacheKey = `heatmap:${tenantId}`
    const cached = await redisConnection.get(cacheKey)
    if (cached) return NextResponse.json(JSON.parse(cached))

    const dias = Math.min(
      90,
      Math.max(1, parseInt(req.nextUrl.searchParams.get('dias') ?? '30'))
    )
    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000)

    const pedidos = await prisma.pedido.findMany({
      where: { tenantId, status: 'FINALIZADO', fechadoEm: { gte: desde } },
      select: { total: true, fechadoEm: true },
    })

    // grid[diaSemana][hora] = { soma, count }
    const grid: { soma: number; count: number }[][] = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => ({ soma: 0, count: 0 }))
    )
    for (const p of pedidos) {
      const d = new Date(p.fechadoEm!)
      const dia = d.getDay() // 0=Dom
      const hora = d.getHours()
      grid[dia][hora].soma += p.total
      grid[dia][hora].count += 1
    }

    const result = grid.map((row) =>
      row.map((cell) => ({
        media: cell.count > 0 ? cell.soma / cell.count : 0,
        pedidos: cell.count,
      }))
    )

    await redisConnection.set(cacheKey, JSON.stringify(result), 'EX', 3600)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[dashboard/heatmap]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
