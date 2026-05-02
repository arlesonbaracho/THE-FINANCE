import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'

export async function GET(req: Request) {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') as 'INGREDIENT' | 'PRODUCT' | null

  try {
    const categories = await prisma.category.findMany({
      where: {
        tenantId,
        ...(type && { type }),
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(categories)
  } catch (error) {
    console.error('[CATEGORIES GET]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  try {
    const body = await req.json()
    const { name, type } = body

    if (!name || !type) {
      return NextResponse.json(
        { error: 'Nome e tipo são obrigatórios' },
        { status: 400 }
      )
    }

    if (!['INGREDIENT', 'PRODUCT'].includes(type)) {
      return NextResponse.json(
        { error: 'Tipo deve ser INGREDIENT ou PRODUCT' },
        { status: 400 }
      )
    }

    const category = await prisma.category.upsert({
      where: { name_type_tenantId: { name, type, tenantId } },
      create: { name, type, tenantId },
      update: {},
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    console.error('[CATEGORIES POST]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
