import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { pedidoItemSchema } from '@/lib/validations'
import { calcPedidoTotal } from '@/lib/pdv'

async function getTenantId(req: NextRequest): Promise<string | null> {
  const slug = req.nextUrl.searchParams.get('slug')
  if (slug) {
    const tenant = await prisma.tenant.findFirst({ where: { OR: [{ slug }, { id: slug }] }, select: { id: true } })
    return tenant?.id ?? null
  }
  const session = await getServerSession(authOptions)
  return session?.user?.tenantId ?? null
}

async function recalcTotal(pedidoId: string, tenantId: string) {
  const [itens, config] = await Promise.all([
    prisma.pedidoItem.findMany({
      where: { pedidoId },
      select: { quantidade: true, precoUnitario: true },
    }),
    prisma.configPdv.findUnique({ where: { tenantId } }),
  ])
  const { subtotal, taxaServico, total } = calcPedidoTotal(
    itens,
    config?.taxaServico ?? 10,
    config?.taxaServicoAtiva ?? false,
  )
  await prisma.pedido.update({ where: { id: pedidoId }, data: { subtotal, taxaServico, total } })
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const tenantId = await getTenantId(req)
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pedido = await prisma.pedido.findFirst({ where: { id: params.id, tenantId, status: 'ABERTO' } })
  if (!pedido) return NextResponse.json({ error: 'Pedido não encontrado ou não está aberto' }, { status: 404 })

  const body = await req.json()
  const parsed = pedidoItemSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })

  const product = await prisma.product.findFirst({
    where: { id: parsed.data.productId, tenantId },
    select: { salePrice: true },
  })
  if (!product) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })

  const item = await prisma.pedidoItem.create({
    data: {
      pedidoId: params.id,
      productId: parsed.data.productId,
      quantidade: parsed.data.quantidade,
      precoUnitario: product.salePrice,
      observacao: parsed.data.observacao,
    },
  })

  await recalcTotal(params.id, tenantId)
  return NextResponse.json(item, { status: 201 })
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const tenantId = await getTenantId(req)
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const itemId = req.nextUrl.searchParams.get('itemId')
  if (!itemId) return NextResponse.json({ error: 'itemId obrigatório' }, { status: 400 })

  const pedido = await prisma.pedido.findFirst({ where: { id: params.id, tenantId, status: 'ABERTO' } })
  if (!pedido) return NextResponse.json({ error: 'Pedido não encontrado ou não está aberto' }, { status: 404 })

  await prisma.pedidoItem.delete({ where: { id: itemId } })
  await recalcTotal(params.id, tenantId)
  return NextResponse.json({ ok: true })
}
