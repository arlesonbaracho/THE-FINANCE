import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { criarPedidoSchema } from '@/lib/validations'
import { calcPedidoTotal } from '@/lib/pdv'
import type { PedidoStatus } from '@prisma/client'

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')
  const statusParam = req.nextUrl.searchParams.get('status')
  const mesaId = req.nextUrl.searchParams.get('mesaId')

  let tenantId: string | null = null

  if (slug) {
    const tenant = await prisma.tenant.findFirst({
      where: { OR: [{ slug }, { id: slug }] },
      select: { id: true },
    })
    tenantId = tenant?.id ?? null
  } else {
    const session = await getServerSession(authOptions)
    tenantId = session?.user?.tenantId ?? null
  }

  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const statusFilter = statusParam
    ? statusParam.split(',').map((s) => s.trim())
    : undefined

  const pedidos = await prisma.pedido.findMany({
    where: {
      tenantId,
      ...(statusFilter ? { status: { in: statusFilter as PedidoStatus[] } } : {}),
      ...(mesaId ? { mesaId } : {}),
    },
    include: {
      itens: { include: { product: { select: { id: true, name: true, salePrice: true } } } },
      mesa: { select: { id: true, numero: true, identificacao: true } },
      garcom: { select: { id: true, name: true } },
      pagamentos: true,
    },
    orderBy: { criadoEm: 'desc' },
  })

  return NextResponse.json(pedidos)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = criarPedidoSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })

  const { mesaId, garcomId, itens } = parsed.data

  // Find tenant via garcom userId (PIN panels don't have session)
  const garcom = await prisma.user.findFirst({
    where: { id: garcomId },
    select: { id: true, tenantId: true },
  })
  if (!garcom?.tenantId) return NextResponse.json({ error: 'Garçom não encontrado' }, { status: 404 })

  const tenantId = garcom.tenantId

  // Check maxOrdersMonth
  const subscription = await prisma.tenantSubscription.findUnique({
    where: { tenantId },
    include: { plan: true },
  })
  if (subscription) {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    const count = await prisma.pedido.count({
      where: { tenantId, criadoEm: { gte: startOfMonth }, status: { not: 'CANCELADO' } },
    })
    if (count >= subscription.plan.maxOrdersMonth) {
      return NextResponse.json(
        { error: `Limite de ${subscription.plan.maxOrdersMonth} pedidos/mês atingido no seu plano` },
        { status: 422 },
      )
    }
  }

  // Verify mesa belongs to tenant
  const mesa = await prisma.mesa.findFirst({ where: { id: mesaId, tenantId } })
  if (!mesa) return NextResponse.json({ error: 'Mesa não encontrada' }, { status: 404 })

  // Get products and prices
  const productIds = itens.map((i) => i.productId)
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, tenantId },
    select: { id: true, salePrice: true },
  })
  const priceMap = new Map(products.map((p) => [p.id, p.salePrice]))

  const itemsWithPrice = itens.map((i) => ({
    ...i,
    precoUnitario: priceMap.get(i.productId) ?? 0,
  }))

  // Get PDV config for service fee
  const configPdv = await prisma.configPdv.findUnique({ where: { tenantId } })
  const { subtotal, taxaServico, total } = calcPedidoTotal(
    itemsWithPrice,
    configPdv?.taxaServico ?? 10,
    configPdv?.taxaServicoAtiva ?? false,
  )

  const pedido = await prisma.pedido.create({
    data: {
      tenantId,
      mesaId,
      garcomId,
      subtotal,
      taxaServico,
      total,
      itens: {
        create: itemsWithPrice.map((i) => ({
          productId: i.productId,
          quantidade: i.quantidade,
          precoUnitario: i.precoUnitario,
          observacao: i.observacao,
        })),
      },
    },
    include: {
      itens: { include: { product: { select: { id: true, name: true } } } },
      mesa: { select: { id: true, numero: true } },
    },
  })

  // Mark mesa as OCUPADA
  await prisma.mesa.update({ where: { id: mesaId }, data: { status: 'OCUPADA' } })

  return NextResponse.json(pedido, { status: 201 })
}
