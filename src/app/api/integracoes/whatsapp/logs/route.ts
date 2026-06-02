import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function allowed(role?: string | null) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER'
}

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
      ...(tipo ? { tipo: tipo as 'ALERTA' | 'RESUMO_DIARIO' | 'PEDIDO_IFOOD' } : {}),
      ...(status ? { status: status as 'ENVIADO' | 'FALHOU' } : {}),
      ...(start || end ? {
        createdAt: {
          ...(start ? { gte: new Date(start) } : {}),
          ...(end ? { lte: new Date(new Date(end).setHours(23, 59, 59, 999)) } : {}),
        },
      } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      tipo: true,
      destinatario: true,
      status: true,
      erro: true,
      createdAt: true,
    },
  })

  return NextResponse.json(logs)
}
