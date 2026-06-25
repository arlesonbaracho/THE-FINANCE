import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorizedResponse } from '@/lib/session'
import { movementSchema, zodErrorResponse } from '@/lib/validations'

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  const tenantId = session.user.tenantId

  try {
    const ingredient = await prisma.ingredient.findFirst({
      where: { id: params.id, tenantId },
    })

    if (!ingredient) {
      return NextResponse.json({ error: 'Insumo não encontrado' }, { status: 404 })
    }

    const movements = await prisma.ingredientMovement.findMany({
      where: { ingredientId: params.id, tenantId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    return NextResponse.json(movements)
  } catch (error) {
    console.error('[MOVEMENTS GET]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  const tenantId = session.user.tenantId
  const userRole = session.user.role

  try {
    const body = await req.json()
    const parsed = movementSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(zodErrorResponse(parsed.error), { status: 400 })
    }

    const { type, quantity, unitCost, reason, note } = parsed.data

    if (type === 'ADJUSTMENT' && !['ADMIN', 'MANAGER', 'SUPER_ADMIN'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Sem permissão para realizar ajuste de estoque' },
        { status: 403 }
      )
    }

    const ingredient = await prisma.ingredient.findFirst({
      where: { id: params.id, tenantId },
    })

    if (!ingredient) {
      return NextResponse.json({ error: 'Insumo não encontrado' }, { status: 404 })
    }

    const isEntry = type === 'IN'
    const isExit = ['OUT', 'LOSS', 'EXPIRY', 'INTERNAL_USE'].includes(type)
    const entryUnitCost = unitCost ?? ingredient.unitCost

    if (isExit && ingredient.currentQty < quantity) {
      return NextResponse.json(
        { error: `Estoque insuficiente. Disponível: ${ingredient.currentQty} ${ingredient.unit}` },
        { status: 422 }
      )
    }

    let newQty = ingredient.currentQty
    let newCmp = ingredient.custoMedioPonderado

    if (isEntry) {
      const qtdAtual = ingredient.currentQty
      const qtdEntrada = quantity
      newQty = qtdAtual + qtdEntrada
      if (newQty > 0) {
        newCmp = (qtdAtual * ingredient.custoMedioPonderado + qtdEntrada * entryUnitCost) / newQty
      }
    } else if (isExit) {
      newQty = ingredient.currentQty - quantity
    } else if (type === 'ADJUSTMENT') {
      newQty = quantity
    }

    const totalCost = isEntry ? quantity * entryUnitCost : undefined

    const [movement] = await prisma.$transaction([
      prisma.ingredientMovement.create({
        data: {
          ingredientId: params.id,
          tenantId,
          type,
          quantity,
          unitCost: isEntry ? entryUnitCost : null,
          totalCost: totalCost ?? null,
          reason: reason ?? null,
          note: note ?? null,
          createdBy: session.user.id,
        },
      }),
      prisma.ingredient.update({
        where: { id: params.id },
        data: {
          currentQty: newQty,
          custoMedioPonderado: newCmp,
        },
      }),
    ])

    return NextResponse.json(movement, { status: 201 })
  } catch (error) {
    console.error('[MOVEMENTS POST]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
