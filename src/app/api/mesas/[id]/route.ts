import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { mesaSchema } from '@/lib/validations'
import { checkPermission, PERMISSIONS } from '@/lib/permissions'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = await checkPermission(session.user.id, session.user.tenantId, PERMISSIONS.MESAS_GERENCIAR)
  if (!allowed) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const mesa = await prisma.mesa.findFirst({
    where: { id: params.id, tenantId: session.user.tenantId },
  })
  if (!mesa) return NextResponse.json({ error: 'Mesa não encontrada' }, { status: 404 })

  const body = await req.json()
  const parsed = mesaSchema.partial().safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })

  const updated = await prisma.mesa.update({ where: { id: params.id }, data: parsed.data })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = await checkPermission(session.user.id, session.user.tenantId, PERMISSIONS.MESAS_GERENCIAR)
  if (!allowed) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const mesa = await prisma.mesa.findFirst({
    where: { id: params.id, tenantId: session.user.tenantId },
  })
  if (!mesa) return NextResponse.json({ error: 'Mesa não encontrada' }, { status: 404 })
  if (mesa.status === 'OCUPADA') {
    return NextResponse.json({ error: 'Não é possível excluir uma mesa ocupada' }, { status: 409 })
  }

  await prisma.mesa.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
