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
    const ingredients = await prisma.ingredient.findMany({
      where: {
        tenantId,
        ...(search && {
          name: { contains: search, mode: 'insensitive' },
        }),
        ...(categoryId && { categoryId }),
      },
      include: {
        category: true,
        supplier: true,
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(ingredients)
  } catch (error) {
    console.error('[INGREDIENTS GET]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  try {
    const body = await req.json()
    const { name, unit, currentQty, minimumQty, unitCost, categoryId, supplierId } = body

    if (!name || !unit) {
      return NextResponse.json({ error: 'Nome e unidade são obrigatórios' }, { status: 400 })
    }

    const ingredient = await prisma.ingredient.create({
      data: {
        name,
        unit,
        currentQty: currentQty ?? 0,
        minimumQty: minimumQty ?? 0,
        unitCost: unitCost ?? 0,
        tenantId,
        categoryId: categoryId || null,
        supplierId: supplierId || null,
      },
      include: { category: true, supplier: true },
    })

    return NextResponse.json(ingredient, { status: 201 })
  } catch (error) {
    console.error('[INGREDIENTS POST]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
