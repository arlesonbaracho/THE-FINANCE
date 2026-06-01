import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { conectar } from '@/services/integrations/ifood/ifood-auth.service'

function allowed(role?: string | null) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER'
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId || !allowed(session.user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const tenantId = session.user.tenantId

  const body = await req.json()
  const { clientId, clientSecret } = body
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'clientId e clientSecret são obrigatórios' }, { status: 400 })
  }

  try {
    await conectar(tenantId, clientId, clientSecret)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }
}

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId || !allowed(session.user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const tenantId = session.user.tenantId

  const integration = await prisma.iFoodIntegration.findUnique({
    where: { tenantId },
    select: { status: true, merchantId: true, ultimaSincronizacao: true, clientId: true },
  })

  if (!integration) return NextResponse.json({ status: 'DESCONECTADO' })

  const pedidosHoje = await prisma.iFoodPedido.count({
    where: {
      tenantId,
      createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    },
  })

  return NextResponse.json({ ...integration, pedidosHoje })
}
