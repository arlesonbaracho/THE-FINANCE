import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'
import { ingredientSchema, zodErrorResponse } from '@/lib/validations'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  try {
    const ingredient = await prisma.ingredient.findFirst({
      where: { id: params.id, tenantId },
      include: {
        category: true,
        supplier: true,
        fornecedorSecundario: true,
        movements: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    })

    if (!ingredient) {
      return NextResponse.json({ error: 'Insumo não encontrado' }, { status: 404 })
    }

    return NextResponse.json(ingredient)
  } catch (error) {
    console.error('[INGREDIENT GET]', error instanceof Error ? error.message : 'unknown')
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
    const parsed = ingredientSchema.partial().safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(zodErrorResponse(parsed.error), { status: 400 })
    }

    const ingredient = await prisma.ingredient.findFirst({
      where: { id: params.id, tenantId },
    })

    if (!ingredient) {
      return NextResponse.json({ error: 'Insumo não encontrado' }, { status: 404 })
    }

    const d = parsed.data

    const updated = await prisma.ingredient.update({
      where: { id: params.id },
      data: {
        ...(d.name !== undefined && { name: d.name }),
        ...(d.unit !== undefined && { unit: d.unit }),
        ...(d.unidadeCompra !== undefined && { unidadeCompra: d.unidadeCompra }),
        ...(d.fatorConversao !== undefined && { fatorConversao: d.fatorConversao }),
        ...(d.minimumQty !== undefined && { minimumQty: d.minimumQty }),
        ...(d.quantidadeMaxima !== undefined && { quantidadeMaxima: d.quantidadeMaxima }),
        ...(d.pontoReposicao !== undefined && { pontoReposicao: d.pontoReposicao }),
        ...(d.unitCost !== undefined && { unitCost: d.unitCost }),
        ...(d.subcategoria !== undefined && { subcategoria: d.subcategoria }),
        ...(d.localizacao !== undefined && { localizacao: d.localizacao }),
        ...(d.foto !== undefined && { foto: d.foto }),
        ...(d.dataValidade !== undefined && {
          dataValidade: d.dataValidade ? new Date(d.dataValidade) : null,
        }),
        ...(d.categoryId !== undefined && { categoryId: d.categoryId ?? null }),
        ...(d.supplierId !== undefined && { supplierId: d.supplierId ?? null }),
        ...(d.fornecedorSecundarioId !== undefined && {
          fornecedorSecundarioId: d.fornecedorSecundarioId ?? null,
        }),
      },
      include: { category: true, supplier: true, fornecedorSecundario: true },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[INGREDIENT PUT]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  try {
    const ingredient = await prisma.ingredient.findFirst({
      where: { id: params.id, tenantId },
    })

    if (!ingredient) {
      return NextResponse.json({ error: 'Insumo não encontrado' }, { status: 404 })
    }

    await prisma.ingredient.delete({ where: { id: params.id } })

    return NextResponse.json({ message: 'Insumo excluído' })
  } catch (error) {
    console.error('[INGREDIENT DELETE]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
