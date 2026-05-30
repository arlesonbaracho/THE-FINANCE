import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'

export async function GET(req: NextRequest) {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  const caixaId = req.nextUrl.searchParams.get('caixaId')
  if (!caixaId) {
    return NextResponse.json({ error: 'caixaId é obrigatório' }, { status: 400 })
  }

  try {
    const sessao = await prisma.sessaoCaixa.findFirst({
      where: { tenantId, usuarioId: caixaId, fechadoEm: null },
      select: { abertoEm: true },
    })

    const [pedidosAbertos, ultimosPedidos] = await Promise.all([
      prisma.pedido.findMany({
        where: {
          tenantId,
          garcomId: caixaId,
          status: { in: ['ABERTO', 'EM_PREPARO', 'PRONTO'] },
        },
        select: {
          id: true,
          total: true,
          mesa: { select: { numero: true } },
          criadoEm: true,
        },
        orderBy: { criadoEm: 'desc' },
      }),
      prisma.pedido.findMany({
        where: {
          tenantId,
          garcomId: caixaId,
          status: 'FINALIZADO',
          ...(sessao ? { fechadoEm: { gte: sessao.abertoEm } } : {}),
        },
        select: {
          id: true,
          total: true,
          mesa: { select: { numero: true } },
          fechadoEm: true,
        },
        orderBy: { fechadoEm: 'desc' },
        take: 5,
      }),
    ])

    const totalSessao = ultimosPedidos.reduce((s, p) => s + p.total, 0)
    const ticketMedio =
      ultimosPedidos.length > 0 ? totalSessao / ultimosPedidos.length : 0

    return NextResponse.json({
      pedidosAbertos,
      ultimosPedidos,
      totalSessao,
      ticketMedio,
    })
  } catch (error) {
    console.error('[dashboard/caixa]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
