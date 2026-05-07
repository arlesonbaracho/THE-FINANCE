import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { checkPermission, PERMISSIONS } from '@/lib/permissions'

const updateSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  permissions: z.array(z.string()).min(1).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.user.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const allowed = await checkPermission(session.user.id, session.user.tenantId, PERMISSIONS.USUARIOS_GERENCIAR)
  if (!allowed) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const role = await prisma.role.findFirst({ where: { id, tenantId: session.user.tenantId } })
  if (!role) return NextResponse.json({ error: 'Função não encontrada' }, { status: 404 })
  if (role.isDefault) return NextResponse.json({ error: 'Funções padrão não podem ser editadas' }, { status: 400 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  const updated = await prisma.role.update({ where: { id }, data: parsed.data })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.user.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const allowed = await checkPermission(session.user.id, session.user.tenantId, PERMISSIONS.USUARIOS_GERENCIAR)
  if (!allowed) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const role = await prisma.role.findFirst({ where: { id, tenantId: session.user.tenantId } })
  if (!role) return NextResponse.json({ error: 'Função não encontrada' }, { status: 404 })
  if (role.isDefault) return NextResponse.json({ error: 'Funções padrão não podem ser removidas' }, { status: 400 })

  // Unassign users first
  await prisma.user.updateMany({ where: { customRoleId: id }, data: { customRoleId: null } })
  await prisma.role.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
