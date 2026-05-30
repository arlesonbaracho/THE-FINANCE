import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyKdsToken } from '@/lib/kds-auth'
import { z } from 'zod'

const schema = z.object({
  novoStatus: z.enum(['ABERTO', 'EM_PREPARO', 'PRONTO', 'ENTREGUE']),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = req.headers.get('authorization')
  const token = auth?.replace('Bearer ', '') ?? ''
  const payload = await verifyKdsToken(token)
  if (!payload) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Status inválido' },
      { status: 400 }
    )
  }

  try {
    const result = await prisma.pedido.updateMany({
      where: { id: params.id, tenantId: payload.tenantId },
      data: { status: parsed.data.novoStatus },
    })

    if (result.count === 0) {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
    }

    const io = (
      global as {
        io?: { to: (r: string) => { emit: (e: string, d: unknown) => void } }
      }
    ).io
    io?.to(payload.tenantId).emit('pedido:status', {
      pedidoId: params.id,
      status: parsed.data.novoStatus,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[pedidos/status]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
