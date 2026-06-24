import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorizedResponse } from '@/lib/session'
import { excluirDadosCliente } from '@/services/lgpd/cliente-dados.service'

function permitido(role?: string | null) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER'
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  if (!permitido(session.user.role)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const telefone: string = body?.telefone ?? ''
  const nome: string | undefined = body?.nome ?? undefined
  if (!telefone && !nome) return NextResponse.json({ error: 'Informe um telefone.' }, { status: 400 })
  const contagens = await excluirDadosCliente(session.user.tenantId, telefone, nome)
  return NextResponse.json(contagens)
}
