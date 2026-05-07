import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'
import { ingredientSchema, zodErrorResponse } from '@/lib/validations'

async function generateCodigoInterno(tenantId: string): Promise<string> {
  const last = await prisma.ingredient.findFirst({
    where: { tenantId, codigoInterno: { not: null } },
    orderBy: { codigoInterno: 'desc' },
    select: { codigoInterno: true },
  })
  if (!last?.codigoInterno) return 'INS-0001'
  const num = parseInt(last.codigoInterno.replace('INS-', ''), 10)
  return `INS-${String(num + 1).padStart(4, '0')}`
}

export async function GET(req: Request) {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')?.slice(0, 100)
  const categoryId = searchParams.get('categoryId')
  const status = searchParams.get('status') // 'ok' | 'low' | 'critical' | 'expiring'

  try {
    const ingredients = await prisma.ingredient.findMany({
      where: {
        tenantId,
        ...(search && { name: { contains: search, mode: 'insensitive' } }),
        ...(categoryId && { categoryId }),
      },
      include: {
        category: true,
        supplier: true,
        fornecedorSecundario: true,
      },
      orderBy: { name: 'asc' },
      take: 500,
    })

    // Compute stock status client-side filter
    const now = new Date()
    const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const withStatus = ingredients.map((ing) => {
      let stockStatus: 'ok' | 'low' | 'critical' | 'expiring' | 'expired'
      if (ing.currentQty <= 0) stockStatus = 'critical'
      else if (ing.currentQty <= ing.minimumQty) stockStatus = 'critical'
      else if (ing.currentQty <= ing.pontoReposicao) stockStatus = 'low'
      else stockStatus = 'ok'

      if (ing.dataValidade) {
        if (ing.dataValidade < now) stockStatus = 'expired'
        else if (ing.dataValidade <= sevenDays) stockStatus = 'expiring'
      }

      return { ...ing, stockStatus }
    })

    const filtered = status
      ? withStatus.filter((i) => i.stockStatus === status)
      : withStatus

    return NextResponse.json(filtered)
  } catch (error) {
    console.error('[INGREDIENTS GET]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  try {
    const body = await req.json()
    const parsed = ingredientSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(zodErrorResponse(parsed.error), { status: 400 })
    }

    const d = parsed.data
    const codigoInterno = await generateCodigoInterno(tenantId)

    const ingredient = await prisma.ingredient.create({
      data: {
        codigoInterno,
        name: d.name,
        unit: d.unit,
        unidadeCompra: d.unidadeCompra ?? null,
        fatorConversao: d.fatorConversao ?? 1,
        currentQty: d.currentQty ?? 0,
        minimumQty: d.minimumQty ?? 0,
        quantidadeMaxima: d.quantidadeMaxima ?? null,
        pontoReposicao: d.pontoReposicao ?? 0,
        unitCost: d.unitCost ?? 0,
        custoMedioPonderado: d.unitCost ?? 0,
        subcategoria: d.subcategoria ?? null,
        localizacao: d.localizacao ?? null,
        foto: d.foto ?? null,
        dataValidade: d.dataValidade ? new Date(d.dataValidade) : null,
        tenantId,
        categoryId: d.categoryId ?? null,
        supplierId: d.supplierId ?? null,
        fornecedorSecundarioId: d.fornecedorSecundarioId ?? null,
      },
      include: { category: true, supplier: true, fornecedorSecundario: true },
    })

    return NextResponse.json(ingredient, { status: 201 })
  } catch (error) {
    console.error('[INGREDIENTS POST]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
