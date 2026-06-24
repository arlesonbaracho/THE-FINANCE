import { NextResponse } from 'next/server'
import { getSession, unauthorizedResponse } from '@/lib/session'
import { listarAcessosPii } from '@/services/lgpd/pii-access-log.service'

function permitido(role?: string | null) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER'
}

export async function GET() {
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  if (!permitido(session.user.role)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const acessos = await listarAcessosPii(session.user.tenantId)
  return NextResponse.json(acessos)
}
