import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { checkPermission, PERMISSIONS } from '@/lib/permissions'

const roleSchema = z.object({
  name: z.string().min(2).max(50),
  permissions: z.array(z.string()).min(1),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.user.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const roles = await prisma.role.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    include: { _count: { select: { users: true } } },
  })
  return NextResponse.json(roles)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.user.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const allowed = await checkPermission(session.user.id, session.user.tenantId, PERMISSIONS.USUARIOS_GERENCIAR)
  if (!allowed) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json()
  const parsed = roleSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  const role = await prisma.role.create({
    data: {
      name: parsed.data.name,
      permissions: parsed.data.permissions,
      tenantId: session.user.tenantId,
    },
  })
  return NextResponse.json(role, { status: 201 })
}
