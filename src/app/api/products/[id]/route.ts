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
    const product = await prisma.product.findFirst({
      where: { id: params.id, tenantId },
      include: {
        category: true,
        ingredients: { include: { ingredient: true } },
      },
    })

    if (!product) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
    }

    return NextResponse.json(product)
  } catch (error) {
    console.error('[PRODUCT GET]', error)
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
    const { name, salePrice, categoryId, active } = body

    const product = await prisma.product.findFirst({
      where: { id: params.id, tenantId },
    })

    if (!product) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
    }

    const updated = await prisma.product.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(salePrice !== undefined && { salePrice }),
        ...(categoryId !== undefined && { categoryId: categoryId || null }),
        ...(active !== undefined && { active }),
      },
      include: {
        category: true,
        ingredients: { include: { ingredient: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[PRODUCT PUT]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  try {
    const product = await prisma.product.findFirst({
      where: { id: params.id, tenantId },
    })

    if (!product) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
    }

    await prisma.product.delete({ where: { id: params.id } })

    return NextResponse.json({ message: 'Produto excluído' })
  } catch (error) {
    console.error('[PRODUCT DELETE]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
