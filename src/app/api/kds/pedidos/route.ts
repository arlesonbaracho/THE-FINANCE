import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyKdsToken } from '@/lib/kds-auth'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const token = auth?.replace('Bearer ', '') ?? ''
  const payload = await verifyKdsToken(token)
  if (!payload) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const pedidos = await prisma.pedido.findMany({
      where: {
        tenantId: payload.tenantId,
        status: { in: ['ABERTO', 'EM_PREPARO', 'PRONTO'] },
      },
      include: {
        mesa: { select: { numero: true } },
        itens: {
          include: {
            product: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { criadoEm: 'asc' },
    })

    // Compute average prep time from last 30 days of finalized orders
    const trintaDias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const historico = await prisma.pedido.findMany({
      where: {
        tenantId: payload.tenantId,
        status: 'FINALIZADO',
        criadoEm: { gte: trintaDias },
        fechadoEm: { not: null },
      },
      select: { criadoEm: true, fechadoEm: true },
    })

    const tempoMedioMs =
      historico.length > 0
        ? historico.reduce(
            (s, p) => s + (p.fechadoEm!.getTime() - p.criadoEm.getTime()),
            0
          ) / historico.length
        : parseInt(process.env.DEFAULT_TEMPO_PREPARO_ALERTA ?? '20') * 60 * 1000

    return NextResponse.json({ pedidos, tempoMedioMs })
  } catch (error) {
    console.error('[kds/pedidos]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
