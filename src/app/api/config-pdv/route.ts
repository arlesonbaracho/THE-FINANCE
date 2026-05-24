import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { configPdvSchema } from '@/lib/validations'
import { checkPermission, PERMISSIONS } from '@/lib/permissions'

async function getTenantId(req: NextRequest): Promise<string | null> {
  const slug = req.nextUrl.searchParams.get('slug')
  if (slug) {
    const tenant = await prisma.tenant.findFirst({
      where: { OR: [{ slug }, { id: slug }] },
      select: { id: true },
    })
    return tenant?.id ?? null
  }
  const session = await getServerSession(authOptions)
  return session?.user?.tenantId ?? null
}

export async function GET(req: NextRequest) {
  const tenantId = await getTenantId(req)
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const config = await prisma.configPdv.upsert({
    where: { tenantId },
    create: { tenantId },
    update: {},
  })

  return NextResponse.json(config)
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = await checkPermission(session.user.id, session.user.tenantId, PERMISSIONS.CONFIGURACOES_EDITAR)
  if (!allowed) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json()
  const parsed = configPdvSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })

  const config = await prisma.configPdv.upsert({
    where: { tenantId: session.user.tenantId },
    create: { tenantId: session.user.tenantId, ...parsed.data },
    update: parsed.data,
  })

  return NextResponse.json(config)
}
