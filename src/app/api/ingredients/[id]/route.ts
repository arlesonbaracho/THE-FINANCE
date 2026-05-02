/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  try {
    const ingredient = await prisma.ingredient.findFirst({
      where: { id: params.id, tenantId },
      include: { category: true, supplier: true },
    })

    if (!ingredient) {
      return NextResponse.json({ error: 'Insumo não encontrado' }, { status: 404 })
    }

    return NextResponse.json(ingredient)
  } catch (error) {
    console.error('[INGREDIENT GET]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  try {
    const body = await req.json()
    const { name, unit, currentQty, minimumQty, unitCost, categoryId, supplierId } = body

    const ingredient = await prisma.ingredient.findFirst({
      where: { id: params.id, tenantId },
    })

    if (!ingredient) {
      return NextResponse.json({ error: 'Insumo não encontrado' }, { status: 404 })
    }

    const updated = await prisma.ingredient.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(unit !== undefined && { unit }),
        ...(currentQty !== undefined && { currentQty }),
        ...(minimumQty !== undefined && { minimumQty }),
        ...(unitCost !== undefined && { unitCost }),
        ...(categoryId !== undefined && { categoryId: categoryId || null }),
        ...(supplierId !== undefined && { supplierId: supplierId || null }),
      },
      include: { category: true, supplier: true },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[INGREDIENT PUT]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  try {
    const ingredient = await prisma.ingredient.findFirst({
      where: { id: params.id, tenantId },
    })

    if (!ingredient) {
      return NextResponse.json({ error: 'Insumo não encontrado' }, { status: 404 })
    }

    await prisma.ingredient.delete({ where: { id: params.id } })

    return NextResponse.json({ message: 'Insumo excluído' })
  } catch (error) {
    console.error('[INGREDIENT DELETE]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
