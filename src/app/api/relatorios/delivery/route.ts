import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { unauthorizedResponse } from '@/lib/session'

const ALLOWED_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'MANAGER'])

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId || !ALLOWED_ROLES.has(session.user.role ?? '')) {
    return unauthorizedResponse()
  }
  const tenantId = session.user.tenantId

  const startStr = req.nextUrl.searchParams.get('start')
  const endStr = req.nextUrl.searchParams.get('end')
  const start = startStr ? new Date(startStr) : new Date(new Date().setDate(1))
  const end = endStr ? new Date(endStr) : new Date()
  start.setHours(0, 0, 0, 0)
  end.setHours(23, 59, 59, 999)

  const [pedidosIfood, pedidosTodos, webhookLogs] = await Promise.all([
    prisma.pedido.findMany({
      where: {
        tenantId,
        origem: 'IFOOD',
        status: { not: 'CANCELADO' },
        criadoEm: { gte: start, lte: end },
      },
      include: {
        ifoodPedido: { select: { comissaoPercent: true, statusIfood: true } },
        itens: { include: { product: { select: { id: true, name: true } } } },
      },
    }),
    prisma.pedido.groupBy({
      by: ['origem'],
      where: { tenantId, status: { not: 'CANCELADO' }, criadoEm: { gte: start, lte: end } },
      _count: { id: true },
      _sum: { total: true },
    }),
    prisma.iFoodWebhookLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { ifoodOrderId: true, status: true, erro: true, createdAt: true },
    }),
  ])

  const receitaBruta = pedidosIfood.reduce((s, p) => s + p.total, 0)
  const comissaoTotal = pedidosIfood.reduce((s, p) => {
    const pct = Number(p.ifoodPedido?.comissaoPercent ?? 0) / 100
    return s + p.total * pct
  }, 0)
  const rejeitados = pedidosIfood.filter((p) => p.ifoodPedido?.statusIfood === 'REJECTED').length
  const taxaRejeicao = pedidosIfood.length > 0 ? (rejeitados / pedidosIfood.length) * 100 : 0

  const produtoMap = new Map<string, { name: string; qty: number; receita: number }>()
  for (const p of pedidosIfood) {
    for (const item of p.itens) {
      const key = item.productId
      const current = produtoMap.get(key) ?? { name: item.product.name, qty: 0, receita: 0 }
      produtoMap.set(key, {
        name: item.product.name,
        qty: current.qty + item.quantidade,
        receita: current.receita + item.precoUnitario * item.quantidade,
      })
    }
  }
  const top5 = Array.from(produtoMap.values()).sort((a, b) => b.receita - a.receita).slice(0, 5)

  return NextResponse.json({
    metricas: {
      totalPedidos: pedidosIfood.length,
      receitaBruta,
      comissao: comissaoTotal,
      receitaLiquida: receitaBruta - comissaoTotal,
      ticketMedio: pedidosIfood.length > 0 ? receitaBruta / pedidosIfood.length : 0,
      taxaRejeicao,
    },
    canalDistribuicao: pedidosTodos,
    top5Produtos: top5,
    webhookLogs,
  })
}
