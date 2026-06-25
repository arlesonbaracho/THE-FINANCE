import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorizedResponse } from '@/lib/session'

export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  const tenantId = session.user.tenantId

  try {
    const inventario = await prisma.inventario.findFirst({
      where: { id: params.id, tenantId, status: 'ABERTO' },
      include: { items: true },
    })

    if (!inventario) {
      return NextResponse.json({ error: 'Inventário não encontrado ou já finalizado' }, { status: 404 })
    }

    const itemsWithCount = inventario.items.filter((i) => i.qtdContada !== null)
    if (itemsWithCount.length === 0) {
      return NextResponse.json({ error: 'Nenhum item foi contado' }, { status: 400 })
    }

    // Apply differences as ADJUSTMENT movements and update inventory
    await prisma.$transaction(async (tx) => {
      for (const item of itemsWithCount) {
        const qtdContada = item.qtdContada as number
        const diferenca = qtdContada - item.qtdSistema

        await tx.inventarioItem.update({
          where: { id: item.id },
          data: { diferenca },
        })

        if (diferenca !== 0) {
          await tx.ingredientMovement.create({
            data: {
              ingredientId: item.ingredientId,
              tenantId,
              type: 'ADJUSTMENT',
              quantity: qtdContada,
              reason: `Inventário: ${inventario.nome}`,
              createdBy: session.user.id,
            },
          })

          await tx.ingredient.update({
            where: { id: item.ingredientId },
            data: { currentQty: qtdContada },
          })
        }
      }

      await tx.inventario.update({
        where: { id: params.id },
        data: { status: 'FINALIZADO', finalizadoEm: new Date() },
      })
    })

    return NextResponse.json({ message: 'Inventário finalizado com sucesso' })
  } catch (error) {
    console.error('[INVENTARIO FINALIZAR]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
