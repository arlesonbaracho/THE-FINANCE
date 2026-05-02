import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'

export async function GET(req: Request) {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')
  const categoryId = searchParams.get('categoryId')

  try {
    const products = await prisma.product.findMany({
      where: {
        tenantId,
        ...(search && {
          name: { contains: search, mode: 'insensitive' },
        }),
        ...(categoryId && { categoryId }),
      },
      include: {
        category: true,
        ingredients: {
          include: { ingredient: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(products)
  } catch (error) {
    console.error('[PRODUCTS GET]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  try {
    const body = await req.json()
    const { name, salePrice, categoryId } = body

    if (!name) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }

    const product = await prisma.product.create({
      data: {
        name,
        salePrice: salePrice ?? 0,
        tenantId,
        categoryId: categoryId || null,
      },
      include: {
        category: true,
        ingredients: { include: { ingredient: true } },
      },
    })

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('[PRODUCTS POST]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
