import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'
import { productIngredientSchema, zodErrorResponse } from '@/lib/validations'

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  try {
    // Verify product ownership before returning its ingredients
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
    console.error('[PRODUCT INGREDIENTS GET]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  try {
    const body = await req.json()
    const parsed = productIngredientSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(zodErrorResponse(parsed.error), { status: 400 })
    }

    const { ingredientId, quantity } = parsed.data

    const product = await prisma.product.findFirst({
      where: { id: params.id, tenantId },
    })

    if (!product) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
    }

    // Ensure the ingredient also belongs to this tenant (cross-tenant attack prevention)
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
      create: { productId: params.id, ingredientId, quantity },
      update: { quantity },
      include: { ingredient: true },
    })

    return NextResponse.json(productIngredient, { status: 201 })
  } catch (error) {
    console.error('[PRODUCT INGREDIENTS POST]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
    console.error('[PRODUCT INGREDIENTS DELETE]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
