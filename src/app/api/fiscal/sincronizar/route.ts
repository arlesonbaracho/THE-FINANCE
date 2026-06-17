import { NextResponse } from 'next/server'
import { getSession, unauthorizedResponse } from '@/lib/session'
import { sincronizarNotasDestinadas } from '@/services/fiscal/nf-capture.service'

export async function POST() {
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  try {
    const criadas = await sincronizarNotasDestinadas(session.user.tenantId)
    return NextResponse.json({ ok: true, capturadas: criadas })
  } catch (err) {
    console.error('[fiscal-sincronizar]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Falha na sincronização.' }, { status: 502 })
  }
}
