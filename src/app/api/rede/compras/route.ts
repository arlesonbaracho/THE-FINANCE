import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { checkMultiUnitFeature, MultiUnitForbiddenError } from '@/lib/check-multi-unit'
import { prisma } from '@/lib/prisma'
import { gerarPedidoConsolidado } from '@/services/multi-unit/purchase-order.service'

async function guard() {
  const session = await getSession()
  if (!session?.user?.tenantId) return { session: null, error: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }) }
  try { await checkMultiUnitFeature(session.user.tenantId) }
  catch (e) { if (e instanceof MultiUnitForbiddenError) return { session: null, error: NextResponse.json({ error: e.message }, { status: 403 }) }; throw e }
  return { session, error: null }
}

export async function GET() {
  const { session, error } = await guard()
  if (error) return error

  const pedidos = await prisma.purchaseOrder.findMany({
    where: { brandId: session!.user.brandId! },
    include: { fornecedor: true, _count: { select: { itens: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(pedidos)
}

export async function POST(req: NextRequest) {
  const { session, error } = await guard()
  if (error) return error

  const { fornecedorId } = await req.json()
  const pedido = await gerarPedidoConsolidado(session!.user.brandId!, fornecedorId, session!.user.id)
  return NextResponse.json(pedido, { status: 201 })
}
