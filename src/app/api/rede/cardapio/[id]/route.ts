import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { checkMultiUnitFeature, MultiUnitForbiddenError } from '@/lib/check-multi-unit'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession()
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try { await checkMultiUnitFeature(session.user.tenantId) }
  catch (e) { if (e instanceof MultiUnitForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 }); throw e }

  const body = await req.json()
  const produto = await prisma.product.update({
    where: { id: params.id, brandId: session.user.brandId! },
    data: {
      ...(body.name && { name: body.name }),
      ...(body.salePrice !== undefined && { salePrice: body.salePrice }),
    },
  })
  return NextResponse.json(produto)
}
