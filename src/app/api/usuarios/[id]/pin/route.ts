import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { checkPermission, PERMISSIONS } from '@/lib/permissions'
import bcrypt from 'bcryptjs'

const schema = z.object({
  pin: z.string().length(4).regex(/^\d{4}$/).nullable(),
})

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.user.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const allowed = await checkPermission(session.user.id, session.user.tenantId, PERMISSIONS.USUARIOS_GERENCIAR)
  if (!allowed) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const target = await prisma.user.findFirst({ where: { id, tenantId: session.user.tenantId } })
  if (!target) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'PIN deve ter 4 dígitos numéricos' }, { status: 400 })

  const pinHash = parsed.data.pin ? await bcrypt.hash(parsed.data.pin, 12) : null
  await prisma.user.update({ where: { id }, data: { pin: pinHash } })
  return NextResponse.json({ ok: true })
}
