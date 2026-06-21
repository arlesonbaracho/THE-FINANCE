import { NextResponse } from 'next/server'
import { getSession, unauthorizedResponse } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { prepararImportacaoCardapio } from '@/services/integrations/ifood/ifood-import.service'

export async function GET() {
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  const role = session.user.role
  if (role !== 'ADMIN' && role !== 'SUPER_ADMIN' && role !== 'MANAGER')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const integ = await prisma.iFoodIntegration.findUnique({ where: { tenantId: session.user.tenantId }, select: { status: true } })
  if (integ?.status !== 'CONECTADO') return NextResponse.json({ error: 'Integração iFood não conectada' }, { status: 409 })
  try {
    const preview = await prepararImportacaoCardapio(session.user.tenantId)
    return NextResponse.json(preview)
  } catch (err) {
    console.error('[ifood-cardapio-preview]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Falha ao buscar o cardápio do iFood' }, { status: 502 })
  }
}
