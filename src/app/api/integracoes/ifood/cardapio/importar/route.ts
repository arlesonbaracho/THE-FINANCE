import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorizedResponse } from '@/lib/session'
import { confirmarImportacaoCardapio } from '@/services/integrations/ifood/ifood-import.service'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  const role = session.user.role
  if (role !== 'ADMIN' && role !== 'SUPER_ADMIN' && role !== 'MANAGER')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const { decisoes } = await req.json()
  if (!Array.isArray(decisoes)) return NextResponse.json({ error: 'decisoes inválidas' }, { status: 400 })
  try {
    const r = await confirmarImportacaoCardapio(session.user.tenantId, decisoes)
    return NextResponse.json(r)
  } catch (err) {
    console.error('[ifood-cardapio-importar]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Falha ao importar o cardápio' }, { status: 502 })
  }
}
