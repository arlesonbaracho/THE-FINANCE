import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorizedResponse } from '@/lib/session'
import { emitirNfceParaPedido } from '@/services/fiscal/nfce-emissao.service'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  const role = session.user.role
  if (role !== 'ADMIN' && role !== 'SUPER_ADMIN' && role !== 'MANAGER')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const { pedidoId } = await req.json()
  if (!pedidoId) return NextResponse.json({ error: 'pedidoId obrigatório' }, { status: 400 })
  try {
    const r = await emitirNfceParaPedido(pedidoId, session.user.tenantId)
    return NextResponse.json(r)
  } catch (err) {
    console.error('[nfce-emitir]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Falha ao emitir NFC-e' }, { status: 502 })
  }
}
