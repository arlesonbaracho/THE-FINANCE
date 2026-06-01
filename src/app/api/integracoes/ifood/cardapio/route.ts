import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { listarItensCatalogo } from '@/services/integrations/ifood/ifood-catalog.service'

function allowed(role?: string | null) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER'
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId || !allowed(session.user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const tenantId = session.user.tenantId

  try {
    const [itens, mappings, produtos] = await Promise.all([
      listarItensCatalogo(tenantId),
      prisma.iFoodItemMap.findMany({ where: { tenantId } }),
      prisma.product.findMany({
        where: { tenantId, active: true },
        select: { id: true, name: true, salePrice: true },
        orderBy: { name: 'asc' },
      }),
    ])
    const mappingMap = new Map(mappings.map((m) => [m.ifoodItemId, m.produtoId]))
    const result = itens.map((item) => ({ ...item, produtoId: mappingMap.get(item.id) ?? null }))
    return NextResponse.json({ itens: result, produtos })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId || !allowed(session.user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const tenantId = session.user.tenantId

  const body = await req.json()
  const mappings: Array<{ ifoodItemId: string; ifoodItemNome: string; produtoId: string | null }> = body.mappings ?? []

  await Promise.all(
    mappings.map((m) =>
      prisma.iFoodItemMap.upsert({
        where: { tenantId_ifoodItemId: { tenantId, ifoodItemId: m.ifoodItemId } },
        create: { tenantId, ifoodItemId: m.ifoodItemId, ifoodItemNome: m.ifoodItemNome, produtoId: m.produtoId },
        update: { produtoId: m.produtoId, ifoodItemNome: m.ifoodItemNome },
      })
    )
  )
  return NextResponse.json({ ok: true })
}
