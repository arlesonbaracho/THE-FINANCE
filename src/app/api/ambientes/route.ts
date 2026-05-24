import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ambienteSchema } from '@/lib/validations'
import { checkPermission, PERMISSIONS } from '@/lib/permissions'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ambientes = await prisma.ambiente.findMany({
    where: { tenantId: session.user.tenantId },
    include: { _count: { select: { mesas: true } } },
    orderBy: { ordem: 'asc' },
  })

  return NextResponse.json(ambientes)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = await checkPermission(session.user.id, session.user.tenantId, PERMISSIONS.MESAS_GERENCIAR)
  if (!allowed) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json()
  const parsed = ambienteSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })

  const ambiente = await prisma.ambiente.create({
    data: { ...parsed.data, tenantId: session.user.tenantId },
  })

  return NextResponse.json(ambiente, { status: 201 })
}
