import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession, signImpersonationToken, setImpersonationCookie } from '@/lib/admin-auth'
import { logAdminAction } from '@/lib/admin-logger'
import { getClientIp } from '@/lib/rate-limit'

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const tenant = await prisma.tenant.findFirst({ where: { id: params.id, deletedAt: null } })
    if (!tenant) return NextResponse.json({ error: 'Restaurante não encontrado' }, { status: 404 })

    const token = await signImpersonationToken({
      tenantId: tenant.id,
      tenantName: tenant.name,
      adminId: session.sub,
    })

    setImpersonationCookie(token)

    await logAdminAction({
      adminId: session.sub,
      action: 'IMPERSONATE_TENANT',
      details: { tenantId: params.id, tenantName: tenant.name },
      ip: getClientIp(req),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[ADMIN IMPERSONATE]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
