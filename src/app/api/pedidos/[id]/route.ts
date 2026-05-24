import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateSchema = z.object({
  status: z.enum(['ABERTO', 'EM_PREPARO', 'PRONTO', 'ENTREGUE', 'FINALIZADO', 'CANCELADO']),
})

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const slug = req.nextUrl.searchParams.get('slug')
  let tenantId: string | null = null

  if (slug) {
    const tenant = await prisma.tenant.findFirst({ where: { OR: [{ slug }, { id: slug }] }, select: { id: true } })
    tenantId = tenant?.id ?? null
  } else {
    const session = await getServerSession(authOptions)
    tenantId = session?.user?.tenantId ?? null
  }
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pedido = await prisma.pedido.findFirst({
    where: { id: params.id, tenantId },
    include: {
      itens: { include: { product: { select: { id: true, name: true, salePrice: true } } } },
      mesa: { select: { id: true, numero: true, identificacao: true } },
      garcom: { select: { id: true, name: true } },
      pagamentos: true,
    },
  })
  if (!pedido) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
  return NextResponse.json(pedido)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const slug = req.nextUrl.searchParams.get('slug')
  let tenantId: string | null = null

  if (slug) {
    const tenant = await prisma.tenant.findFirst({ where: { OR: [{ slug }, { id: slug }] }, select: { id: true } })
    tenantId = tenant?.id ?? null
  } else {
    const session = await getServerSession(authOptions)
    tenantId = session?.user?.tenantId ?? null
  }
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pedido = await prisma.pedido.findFirst({ where: { id: params.id, tenantId } })
  if (!pedido) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Status inválido' }, { status: 400 })

  const updated = await prisma.pedido.update({
    where: { id: params.id },
    data: { status: parsed.data.status },
    include: {
      itens: { include: { product: { select: { id: true, name: true } } } },
      mesa: { select: { id: true, numero: true } },
    },
  })

  // Emit socket event if global io is available
  const io = (global as { io?: { to: (room: string) => { emit: (event: string, data: unknown) => void } } }).io
  io?.to(tenantId).emit('pedido:status', { pedidoId: params.id, status: parsed.data.status, mesaId: pedido.mesaId })

  return NextResponse.json(updated)
}
