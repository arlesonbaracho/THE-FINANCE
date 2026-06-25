import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, props: { params: Promise<{ tenantId: string }> }) {
  const params = await props.params;
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { limiteTokens } = await req.json()
  if (typeof limiteTokens !== 'number' || limiteTokens < 0) {
    return NextResponse.json({ error: 'limiteTokens inválido' }, { status: 400 })
  }

  const updated = await prisma.aiUsage.update({
    where: { tenantId: params.tenantId },
    data: { limiteTokens },
  })
  return NextResponse.json(updated)
}

export async function POST(_req: NextRequest, props: { params: Promise<{ tenantId: string }> }) {
  const params = await props.params;
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const agora = new Date()
  const updated = await prisma.aiUsage.update({
    where: { tenantId: params.tenantId },
    data: {
      tokensInput: 0,
      tokensOutput: 0,
      custoEstimado: 0,
      mes: agora.getMonth() + 1,
      ano: agora.getFullYear(),
    },
  })
  return NextResponse.json(updated)
}
