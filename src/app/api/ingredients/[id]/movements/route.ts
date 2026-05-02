/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  try {
    const movements = await prisma.ingredientMovement.findMany({
      where: { ingredientId: params.id, tenantId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(movements)
  } catch (error) {
    console.error('[MOVEMENTS GET]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  try {
    const body = await req.json()
    const { type, quantity, reason, note } = body

    if (!type || !quantity || quantity <= 0) {
      return NextResponse.json(
        { error: 'Tipo e quantidade válida são obrigatórios' },
        { status: 400 }
      )
    }

    const ingredient = await prisma.ingredient.findFirst({
      where: { id: params.id, tenantId },
    })

    if (!ingredient) {
      return NextResponse.json({ error: 'Insumo não encontrado' }, { status: 404 })
    }

    let newQty = ingredient.currentQty
    if (type === 'IN') {
      newQty += quantity
    } else if (type === 'OUT') {
      newQty -= quantity
    } else if (type === 'ADJUSTMENT') {
      newQty = quantity
    }

    const [movement] = await prisma.$transaction([
      prisma.ingredientMovement.create({
        data: {
          ingredientId: params.id,
          tenantId,
          type,
          quantity,
          reason: reason || null,
          note: note || null,
        },
      }),
      prisma.ingredient.update({
        where: { id: params.id },
        data: { currentQty: newQty },
      }),
    ])

    return NextResponse.json(movement, { status: 201 })
  } catch (error) {
    console.error('[MOVEMENTS POST]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
