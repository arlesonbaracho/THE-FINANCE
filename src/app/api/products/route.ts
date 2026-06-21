import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'
import { productSchema, zodErrorResponse } from '@/lib/validations'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug')
  const search = searchParams.get('search')?.slice(0, 100)
  const categoryId = searchParams.get('categoryId')

  let tenantId: string | null = null
  if (slug) {
    const tenant = await prisma.tenant.findFirst({ where: { OR: [{ slug }, { id: slug }] }, select: { id: true } })
    tenantId = tenant?.id ?? null
    if (!tenantId) return NextResponse.json({ error: 'Restaurante não encontrado' }, { status: 404 })
  } else {
    tenantId = await getTenantId()
    if (!tenantId) return unauthorizedResponse()
  }

  try {
    const products = await prisma.product.findMany({
      where: {
        tenantId,
        ...(search && { name: { contains: search, mode: 'insensitive' } }),
        ...(categoryId && { categoryId }),
      },
      include: {
        category: true,
        ingredients: {
          include: { ingredient: true },
        },
      },
      orderBy: { name: 'asc' },
      take: 500,
    })

    return NextResponse.json(products, {
      headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=120' },
    })
  } catch (error) {
    console.error('[PRODUCTS GET]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  try {
    const body = await req.json()
    const parsed = productSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(zodErrorResponse(parsed.error), { status: 400 })
    }

    const { name, salePrice, categoryId, ncm, cfop, cstCsosn, origemMercadoria, unidadeTributavel } = parsed.data

    const product = await prisma.product.create({
      data: {
        name,
        salePrice: salePrice ?? 0,
        tenantId,
        categoryId: categoryId ?? null,
        ...(ncm !== undefined && { ncm: ncm ?? null }),
        ...(cfop !== undefined && { cfop: cfop ?? null }),
        ...(cstCsosn !== undefined && { cstCsosn: cstCsosn ?? null }),
        ...(origemMercadoria !== undefined && { origemMercadoria: origemMercadoria ?? null }),
        ...(unidadeTributavel !== undefined && { unidadeTributavel: unidadeTributavel ?? null }),
      },
      include: {
        category: true,
        ingredients: { include: { ingredient: true } },
      },
    })

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('[PRODUCTS POST]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
