import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { checkPermission, PERMISSIONS } from '@/lib/permissions'

const updateSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  customRoleId: z.string().cuid().nullable().optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'STAFF']).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.user.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const allowed = await checkPermission(session.user.id, session.user.tenantId, PERMISSIONS.USUARIOS_GERENCIAR)
  if (!allowed) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  // Prevent self-deactivation
  if (id === session.user.id) {
    return NextResponse.json({ error: 'Não é possível alterar seu próprio usuário aqui' }, { status: 400 })
  }

  const target = await prisma.user.findFirst({ where: { id, tenantId: session.user.tenantId } })
  if (!target) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  const updated = await prisma.user.update({
    where: { id },
    data: parsed.data,
    select: { id: true, name: true, email: true, role: true, status: true, customRole: { select: { id: true, name: true } } },
  })
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

  if (id === session.user.id) {
    return NextResponse.json({ error: 'Não é possível remover sua própria conta' }, { status: 400 })
  }

  const target = await prisma.user.findFirst({ where: { id, tenantId: session.user.tenantId } })
  if (!target) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  await prisma.user.update({ where: { id }, data: { status: 'INACTIVE', tenantId: null } })
  return NextResponse.json({ ok: true })
}
