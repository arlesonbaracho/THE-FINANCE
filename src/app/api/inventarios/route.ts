import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorizedResponse } from '@/lib/session'

export async function GET() {
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  const tenantId = session.user.tenantId

  try {
    const inventarios = await prisma.inventario.findMany({
      where: { tenantId },
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return NextResponse.json(inventarios)
  } catch (error) {
    console.error('[INVENTARIOS GET]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  const tenantId = session.user.tenantId

  try {
    const body = await req.json()
    const nome = String(body.nome ?? '').trim().slice(0, 150)
    if (!nome) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })

    // Get all active ingredients for this tenant as snapshot
    const ingredients = await prisma.ingredient.findMany({
      where: { tenantId },
      select: { id: true, currentQty: true },
    })

    const inventario = await prisma.inventario.create({
      data: {
        tenantId,
        nome,
        criadoPor: session.user.id,
        items: {
          create: ingredients.map((ing) => ({
            ingredientId: ing.id,
            qtdSistema: ing.currentQty,
          })),
        },
      },
      include: {
        items: { include: { ingredient: { select: { id: true, name: true, unit: true, codigoInterno: true } } } },
      },
    })

    return NextResponse.json(inventario, { status: 201 })
  } catch (error) {
    console.error('[INVENTARIOS POST]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
