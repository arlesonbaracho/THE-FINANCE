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

  const pedidos = await prisma.pedido.findMany({
    where: { tenantId, criadoEm: { gte: start, lte: end } },
    select: {
      garcomId: true,
      garcom: { select: { id: true, name: true, avatarUrl: true } },
      status: true,
      total: true,
      criadoEm: true,
    },
  })

  const opMap = new Map<
    string,
    {
      userId: string
      nome: string
      avatarUrl: string | null
      pedidos: number
      cancelamentos: number
      receita: number
      hoursCount: Map<number, number>
    }
  >()

  for (const p of pedidos) {
    const gid = p.garcomId
    if (!gid || !p.garcom) continue
    const cur = opMap.get(gid) ?? {
      userId: p.garcom.id,
      nome: p.garcom.name ?? '(sem nome)',
      avatarUrl: p.garcom.avatarUrl,
      pedidos: 0,
      cancelamentos: 0,
      receita: 0,
      hoursCount: new Map(),
    }
    cur.pedidos++
    if (p.status === 'CANCELADO') cur.cancelamentos++
    if (p.status === 'FINALIZADO') cur.receita += p.total
    const h = p.criadoEm.getHours()
    cur.hoursCount.set(h, (cur.hoursCount.get(h) ?? 0) + 1)
    opMap.set(gid, cur)
  }

  const operadores = Array.from(opMap.values())
    .map((op) => {
      const horarioPico = Array.from(op.hoursCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0
      const taxaCancelamento = op.pedidos > 0 ? (op.cancelamentos / op.pedidos) * 100 : 0
      const ticketMedio = op.pedidos - op.cancelamentos > 0 ? op.receita / (op.pedidos - op.cancelamentos) : 0
      return {
        userId: op.userId,
        nome: op.nome,
        avatarUrl: op.avatarUrl,
        pedidos: op.pedidos,
        cancelamentos: op.cancelamentos,
        receita: op.receita,
        ticketMedio,
        horarioPico: `${horarioPico}h`,
        taxaCancelamento,
      }
    })
    .sort((a, b) => b.receita - a.receita)

  return NextResponse.json({ operadores })
}
