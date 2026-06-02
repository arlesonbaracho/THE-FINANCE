import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { verificarStatus, getQrCode } from '@/services/integrations/whatsapp/zapi.service'

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
    const { status, numeroConectado } = await verificarStatus(tenantId)
    const qrCode = status !== 'CONECTADO' ? await getQrCode(tenantId) : null
    return NextResponse.json({ status, numeroConectado, qrCode })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }
}
