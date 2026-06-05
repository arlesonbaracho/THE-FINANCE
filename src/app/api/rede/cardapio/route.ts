import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { checkMultiUnitFeature, MultiUnitForbiddenError } from '@/lib/check-multi-unit'
import { prisma } from '@/lib/prisma'

async function guardedSession() {
  const session = await getSession()
  if (!session?.user?.tenantId) return null
  try { await checkMultiUnitFeature(session.user.tenantId) } catch { return null }
  return session
}

export async function GET() {
  const session = await guardedSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const produtos = await prisma.product.findMany({
    where: { brandId: session.user.brandId!, isShared: true },
    include: { category: true, overrides: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(produtos)
}

export async function POST(req: NextRequest) {
  const session = await guardedSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const body = await req.json()
  const produto = await prisma.product.create({
    data: {
      name: body.name,
      salePrice: body.salePrice ?? 0,
      categoryId: body.categoryId ?? null,
      tenantId: session.user.tenantId,
      brandId: session.user.brandId!,
      isShared: true,
    },
  })
  return NextResponse.json(produto, { status: 201 })
}
