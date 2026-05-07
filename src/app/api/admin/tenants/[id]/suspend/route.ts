import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'
import { logAdminAction } from '@/lib/admin-logger'
import { getClientIp } from '@/lib/rate-limit'

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const tenant = await prisma.tenant.findFirst({ where: { id: params.id, deletedAt: null } })
    if (!tenant) return NextResponse.json({ error: 'Restaurante não encontrado' }, { status: 404 })

    const sub = await prisma.tenantSubscription.findUnique({ where: { tenantId: params.id } })
    const isSuspended = sub?.status === 'SUSPENDED'

    await prisma.$transaction([
      prisma.tenant.update({
        where: { id: params.id },
        data: { active: isSuspended },
      }),
      ...(sub
        ? [prisma.tenantSubscription.update({
            where: { tenantId: params.id },
            data: { status: isSuspended ? 'ACTIVE' : 'SUSPENDED' },
          })]
        : []),
    ])

    await logAdminAction({
      adminId: session.sub,
      action: isSuspended ? 'REACTIVATE_TENANT' : 'SUSPEND_TENANT',
      details: { tenantId: params.id },
      ip: getClientIp(req),
    })

    return NextResponse.json({ suspended: !isSuspended })
  } catch (error) {
    console.error('[ADMIN SUSPEND]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
