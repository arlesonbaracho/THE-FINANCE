import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const alerta = await prisma.adminNotification.update({
    where: { id: params.id },
    data: { resolvido: true, resolvidoEm: new Date() },
  })
  return NextResponse.json(alerta)
}
