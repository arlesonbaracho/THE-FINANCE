import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'
import { productSchema, zodErrorResponse } from '@/lib/validations'
import { pausarItem, reativarItem, atualizarPreco } from '@/services/integrations/ifood/ifood-catalog.service'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  try {
    const product = await prisma.product.findFirst({
      where: { id: params.id, tenantId },
      include: {
        category: true,
        ingredients: { include: { ingredient: true } },
      },
    })

    if (!product) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
    }

    return NextResponse.json(product)
  } catch (error) {
    console.error('[PRODUCT GET]', error instanceof Error ? error.message : 'unknown')
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
    const parsed = productSchema.partial().safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(zodErrorResponse(parsed.error), { status: 400 })
    }

    const product = await prisma.product.findFirst({
      where: { id: params.id, tenantId },
    })

    if (!product) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
    }

    const { name, salePrice, categoryId, active, ncm, cfop, cstCsosn, origemMercadoria, unidadeTributavel } = parsed.data

    const updated = await prisma.product.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(salePrice !== undefined && { salePrice }),
        ...(categoryId !== undefined && { categoryId: categoryId ?? null }),
        ...(active !== undefined && { active }),
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

    const response = NextResponse.json(updated)

    // Fire-and-forget: sync relevant changes to iFood if an active integration exists
    void (async () => {
      try {
        const integration = await prisma.iFoodIntegration.findFirst({
          where: { tenantId, status: 'CONECTADO' },
        })
        if (!integration) return

        const mapping = await prisma.iFoodItemMap.findFirst({
          where: { tenantId, produtoId: params.id },
        })
        if (!mapping) return

        if (active !== undefined) {
          if (active === false) {
            await pausarItem(tenantId, mapping.ifoodItemId)
          } else {
            await reativarItem(tenantId, mapping.ifoodItemId)
          }
        }

        if (salePrice !== undefined) {
          await atualizarPreco(tenantId, mapping.ifoodItemId, salePrice)
        }
      } catch (err) {
        console.error('[PRODUCT PUT ifood-sync]', err instanceof Error ? err.message : err)
      }
    })()

    return response
  } catch (error) {
    console.error('[PRODUCT PUT]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  try {
    const product = await prisma.product.findFirst({
      where: { id: params.id, tenantId },
    })

    if (!product) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
    }

    await prisma.product.delete({ where: { id: params.id } })

    return NextResponse.json({ message: 'Produto excluído' })
  } catch (error) {
    console.error('[PRODUCT DELETE]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
