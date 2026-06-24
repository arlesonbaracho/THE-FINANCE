import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorizedResponse } from '@/lib/session'
import { buscarDadosCliente } from '@/services/lgpd/cliente-dados.service'
import { getClientIp } from '@/lib/rate-limit'
import { registrarAcessoPii } from '@/services/lgpd/pii-access-log.service'

function permitido(role?: string | null) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER'
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  if (!permitido(session.user.role)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const telefone = searchParams.get('telefone') ?? ''
  const nome = searchParams.get('nome') ?? undefined
  const dados = await buscarDadosCliente(session.user.tenantId, telefone, nome)
  const total = dados.reservas.length + dados.contatosWhatsapp.length + dados.logsWhatsapp.length
  void registrarAcessoPii({
    tenantId: session.user.tenantId, userId: session.user.id, acao: 'CONSULTA',
    alvo: nome ? `${telefone} ${nome}` : telefone, detalhe: `${total} registros`, ip: getClientIp(req),
  }).catch((e) => console.error('[pii-log]', e instanceof Error ? e.message : e))
  return NextResponse.json(dados)
}
