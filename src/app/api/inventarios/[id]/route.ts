import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorizedResponse } from '@/lib/session'

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  const tenantId = session.user.tenantId

  try {
    const inventario = await prisma.inventario.findFirst({
      where: { id: params.id, tenantId },
      include: {
        items: {
          include: {
            ingredient: {
              select: { id: true, name: true, unit: true, codigoInterno: true },
            },
          },
          orderBy: { ingredient: { name: 'asc' } },
        },
      },
    })

    if (!inventario) {
      return NextResponse.json({ error: 'Inventário não encontrado' }, { status: 404 })
    }

    return NextResponse.json(inventario)
  } catch (error) {
    console.error('[INVENTARIO GET]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// PATCH: update counted quantities for items
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  const tenantId = session.user.tenantId

  try {
    const inventario = await prisma.inventario.findFirst({
      where: { id: params.id, tenantId, status: 'ABERTO' },
    })

    if (!inventario) {
      return NextResponse.json({ error: 'Inventário não encontrado ou já finalizado' }, { status: 404 })
    }

    const body = await req.json()
    // items: Array<{ itemId: string, qtdContada: number, observacao?: string }>
    const items: { itemId: string; qtdContada: number; observacao?: string }[] = body.items ?? []

    await prisma.$transaction(
      items.map(({ itemId, qtdContada, observacao }) =>
        prisma.inventarioItem.update({
          where: { id: itemId, inventarioId: inventario.id },
          data: {
            qtdContada,
            diferenca: undefined, // will compute on finalize
            observacao: observacao ?? null,
          },
        })
      )
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[INVENTARIO PATCH]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  const tenantId = session.user.tenantId

  try {
    const inventario = await prisma.inventario.findFirst({
      where: { id: params.id, tenantId, status: 'ABERTO' },
    })

    if (!inventario) {
      return NextResponse.json({ error: 'Inventário não encontrado ou já finalizado' }, { status: 404 })
    }

    await prisma.inventario.update({
      where: { id: params.id },
      data: { status: 'CANCELADO' },
    })

    return NextResponse.json({ message: 'Inventário cancelado' })
  } catch (error) {
    console.error('[INVENTARIO DELETE]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
