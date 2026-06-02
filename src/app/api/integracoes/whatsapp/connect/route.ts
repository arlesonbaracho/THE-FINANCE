import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { conectar } from '@/services/integrations/whatsapp/zapi.service'

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
  const { instanceId, token } = body
  if (!instanceId || !token) {
    return NextResponse.json({ error: 'instanceId e token são obrigatórios' }, { status: 400 })
  }

  try {
    await conectar(tenantId, instanceId, token)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId || !allowed(session.user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const tenantId = session.user.tenantId

  const body = await req.json()
  const { config } = body
  if (!config || typeof config !== 'object') {
    return NextResponse.json({ error: 'config inválido' }, { status: 400 })
  }

  await prisma.whatsAppIntegration.update({
    where: { tenantId },
    data: { config },
  })
  return NextResponse.json({ ok: true })
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId || !allowed(session.user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const tenantId = session.user.tenantId

  const integration = await prisma.whatsAppIntegration.findUnique({
    where: { tenantId },
    select: { status: true, numeroConectado: true, ultimaConexao: true, config: true, instanceId: true },
  })

  if (!integration) return NextResponse.json({ status: 'DESCONECTADO' })
  return NextResponse.json(integration)
}
