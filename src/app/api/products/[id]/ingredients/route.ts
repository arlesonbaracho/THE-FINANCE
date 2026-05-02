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
    })

    if (!product) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
    }

    const productIngredients = await prisma.productIngredient.findMany({
      where: { productId: params.id },
      include: { ingredient: true },
    })

    return NextResponse.json(productIngredients)
  } catch (error) {
    console.error('[PRODUCT INGREDIENTS GET]', error)
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
    const { ingredientId, quantity } = body

    if (!ingredientId || !quantity || quantity <= 0) {
      return NextResponse.json(
        { error: 'Insumo e quantidade válida são obrigatórios' },
        { status: 400 }
      )
    }

    const product = await prisma.product.findFirst({
      where: { id: params.id, tenantId },
    })

    if (!product) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
    }

    const ingredient = await prisma.ingredient.findFirst({
      where: { id: ingredientId, tenantId },
    })

    if (!ingredient) {
      return NextResponse.json({ error: 'Insumo não encontrado' }, { status: 404 })
    }

    const productIngredient = await prisma.productIngredient.upsert({
      where: {
        productId_ingredientId: {
          productId: params.id,
          ingredientId,
        },
      },
      create: {
        productId: params.id,
        ingredientId,
        quantity,
      },
      update: { quantity },
      include: { ingredient: true },
    })

    return NextResponse.json(productIngredient, { status: 201 })
  } catch (error) {
    console.error('[PRODUCT INGREDIENTS POST]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  try {
    const { searchParams } = new URL(req.url)
    const ingredientId = searchParams.get('ingredientId')

    if (!ingredientId) {
      return NextResponse.json({ error: 'ingredientId é obrigatório' }, { status: 400 })
    }

    const product = await prisma.product.findFirst({
      where: { id: params.id, tenantId },
    })

    if (!product) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
    }

    await prisma.productIngredient.delete({
      where: {
        productId_ingredientId: {
          productId: params.id,
          ingredientId,
        },
      },
    })

    return NextResponse.json({ message: 'Insumo removido do produto' })
  } catch (error) {
    console.error('[PRODUCT INGREDIENTS DELETE]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
