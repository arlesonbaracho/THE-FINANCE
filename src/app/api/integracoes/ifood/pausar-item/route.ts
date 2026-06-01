import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { pausarItem } from '@/services/integrations/ifood/ifood-catalog.service'

function allowed(role?: string | null) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER'
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId || !allowed(session.user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { ifoodItemId } = await req.json()
  if (!ifoodItemId) return NextResponse.json({ error: 'ifoodItemId obrigatório' }, { status: 400 })

  try {
    await pausarItem(session.user.tenantId, ifoodItemId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
