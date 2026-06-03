import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function allowed(role?: string | null) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER'
}

const VALID_TIPOS = new Set([
  'ALERTA_CRITICO', 'ALERTA_ALTO', 'ESTOQUE_BAIXO', 'RESUMO_DIARIO',
  'LIMITE_IA', 'CONFIRMACAO_BOT', 'RESPOSTA_BOT', 'TESTE',
])
const VALID_STATUS = new Set(['ENVIADO', 'FALHOU', 'PENDENTE'])

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId || !allowed(session.user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const tenantId = session.user.tenantId

  const tipo = req.nextUrl.searchParams.get('tipo') ?? undefined
  const status = req.nextUrl.searchParams.get('status') ?? undefined
  const start = req.nextUrl.searchParams.get('start')
  const end = req.nextUrl.searchParams.get('end')

  const logs = await prisma.whatsAppLog.findMany({
    where: {
      tenantId,
      ...(tipo && VALID_TIPOS.has(tipo) ? { tipo: tipo as never } : {}),
      ...(status && VALID_STATUS.has(status) ? { status: status as never } : {}),
      ...(start || end ? {
        createdAt: {
          ...(start ? { gte: new Date(start) } : {}),
          ...(end ? { lte: new Date(new Date(end).setHours(23, 59, 59, 999)) } : {}),
        },
      } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, tipo: true, destinatario: true, status: true, erro: true, createdAt: true },
  })

  return NextResponse.json(logs)
}
