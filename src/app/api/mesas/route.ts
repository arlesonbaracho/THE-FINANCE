import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { mesaSchema } from '@/lib/validations'
import { checkPermission, PERMISSIONS } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')

  // Public access via slug (for PIN panels)
  if (slug) {
    const tenant = await prisma.tenant.findFirst({
      where: { OR: [{ slug }, { id: slug }] },
      select: { id: true },
    })
    if (!tenant) return NextResponse.json({ error: 'Restaurante não encontrado' }, { status: 404 })

    const mesas = await prisma.mesa.findMany({
      where: { tenantId: tenant.id },
      include: { ambiente: { select: { id: true, nome: true } } },
      orderBy: [{ ambienteId: 'asc' }, { numero: 'asc' }],
    })
    return NextResponse.json(mesas)
  }

  // Authenticated access for dashboard
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const mesas = await prisma.mesa.findMany({
    where: { tenantId: session.user.tenantId },
    include: { ambiente: { select: { id: true, nome: true } } },
    orderBy: [{ ambienteId: 'asc' }, { numero: 'asc' }],
  })
  return NextResponse.json(mesas)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = await checkPermission(session.user.id, session.user.tenantId, PERMISSIONS.MESAS_GERENCIAR)
  if (!allowed) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json()

  // Batch creation: array of mesas
  if (Array.isArray(body)) {
    const results = []
    for (const item of body) {
      const parsed = mesaSchema.safeParse(item)
      if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
      const mesa = await prisma.mesa.create({
        data: { ...parsed.data, tenantId: session.user.tenantId },
      })
      results.push(mesa)
    }
    return NextResponse.json(results, { status: 201 })
  }

  const parsed = mesaSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })

  const mesa = await prisma.mesa.create({
    data: { ...parsed.data, tenantId: session.user.tenantId },
  })
  return NextResponse.json(mesa, { status: 201 })
}
