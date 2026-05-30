import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { calcBaixaEstoque } from '@/lib/pdv'

const schema = z.object({
  formaPagamento: z.enum(['DINHEIRO', 'DEBITO', 'CREDITO', 'PIX']),
  valor: z.number().positive(),
  slug: z.string().optional(),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })

  const { formaPagamento, valor } = parsed.data

  const pedido = await prisma.pedido.findFirst({
    where: { id: params.id },
    include: {
      itens: {
        include: {
          product: {
            include: {
              ingredients: { select: { ingredientId: true, quantity: true } },
            },
          },
        },
      },
    },
  })

  if (!pedido) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
  if (pedido.status === 'FINALIZADO') return NextResponse.json({ error: 'Pedido já finalizado' }, { status: 409 })
  if (pedido.status === 'CANCELADO') return NextResponse.json({ error: 'Pedido cancelado' }, { status: 409 })

  // Prepare stock deduction
  const itensParaBaixa = pedido.itens.map((i) => ({ productId: i.productId, quantidade: i.quantidade }))
  const productsData = pedido.itens.map((i) => ({
    id: i.productId,
    ingredients: i.product.ingredients,
  }))
  const baixas = calcBaixaEstoque(itensParaBaixa, productsData)

  // Execute everything in a transaction
  await prisma.$transaction(async (tx) => {
    // Create payment
    await tx.pagamento.create({
      data: { pedidoId: params.id, formaPagamento, valor },
    })

    // Stock OUT movements
    for (const baixa of baixas) {
      const ingredient = await tx.ingredient.findFirst({
        where: { id: baixa.ingredientId, tenantId: pedido.tenantId },
        select: { currentQty: true },
      })
      if (!ingredient) continue

      await tx.ingredientMovement.create({
        data: {
          ingredientId: baixa.ingredientId,
          tenantId: pedido.tenantId,
          type: 'OUT',
          quantity: baixa.quantity,
          reason: `Pedido #${params.id}`,
        },
      })

      await tx.ingredient.update({
        where: { id: baixa.ingredientId },
        data: { currentQty: Math.max(0, ingredient.currentQty - baixa.quantity) },
      })
    }

    // Mark pedido as FINALIZADO
    await tx.pedido.update({
      where: { id: params.id },
      data: { status: 'FINALIZADO', fechadoEm: new Date() },
    })

    // Free the mesa
    await tx.mesa.update({
      where: { id: pedido.mesaId },
      data: { status: 'LIVRE' },
    })
  })

  // Emit socket events
  const io = (global as { io?: { to: (room: string) => { emit: (event: string, data: unknown) => void } } }).io
  io?.to(pedido.tenantId).emit('mesa:status', { mesaId: pedido.mesaId, status: 'LIVRE' })
  io?.to(pedido.tenantId).emit('pedido:status', { pedidoId: params.id, status: 'FINALIZADO' })
  io?.to(pedido.tenantId).emit('dashboard:atualizar', {
    tipo: 'pedido_finalizado',
    pedidoId: params.id,
    total: pedido.total,
  })

  return NextResponse.json({ ok: true })
}
