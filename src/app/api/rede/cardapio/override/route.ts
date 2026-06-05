import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { checkMultiUnitFeature, MultiUnitForbiddenError } from '@/lib/check-multi-unit'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try { await checkMultiUnitFeature(session.user.tenantId) }
  catch (e) { if (e instanceof MultiUnitForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 }); throw e }

  const { tenantId, produtoId, preco, ativo } = await req.json()

  const override = await prisma.produtoOverride.upsert({
    where: { tenantId_produtoId: { tenantId, produtoId } },
    create: { tenantId, produtoId, preco: preco ?? null, ativo: ativo ?? true },
    update: { preco: preco ?? null, ativo: ativo ?? true },
  })
  return NextResponse.json(override)
}
