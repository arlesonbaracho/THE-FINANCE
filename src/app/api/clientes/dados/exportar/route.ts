import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorizedResponse } from '@/lib/session'
import { buscarDadosCliente } from '@/services/lgpd/cliente-dados.service'

function permitido(role?: string | null) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER'
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  if (!permitido(session.user.role)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const dados = await buscarDadosCliente(session.user.tenantId, searchParams.get('telefone') ?? '', searchParams.get('nome') ?? undefined)
  return new NextResponse(JSON.stringify(dados, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="dados-cliente.json"' },
  })
}
