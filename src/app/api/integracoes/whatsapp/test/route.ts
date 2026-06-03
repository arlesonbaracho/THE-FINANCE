import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { enviarTeste } from '@/lib/whatsapp/whatsapp-messages.service'

function allowed(role?: string | null) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER'
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId || !allowed(session.user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const tenantId = session.user.tenantId

  const body = await req.json().catch(() => ({}))
  const { numero } = body as { numero?: string }

  let destino = numero
  if (!destino) {
    const contato = await prisma.whatsAppContato.findFirst({
      where: { tenantId, ativo: true },
      select: { numero: true },
    })
    destino = contato?.numero
  }

  if (!destino) {
    return NextResponse.json({ error: 'Nenhum contato cadastrado. Adicione um contato primeiro.' }, { status: 400 })
  }

  const ok = await enviarTeste(tenantId, destino)
  return NextResponse.json({ ok })
}
