import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

function allowed(role?: string | null) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER'
}

const updateSchema = z.object({
  nome: z.string().min(1).max(100).trim().optional(),
  permiteComandos: z.boolean().optional(),
  recebeAlertas: z.boolean().optional(),
  recebeResumoDiario: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId || !allowed(session.user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const tenantId = session.user.tenantId

  const contato = await prisma.whatsAppContato.findFirst({ where: { id: params.id, tenantId } })
  if (!contato) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
  }

  const updated = await prisma.whatsAppContato.update({ where: { id: params.id }, data: parsed.data })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId || !allowed(session.user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const tenantId = session.user.tenantId

  const contato = await prisma.whatsAppContato.findFirst({ where: { id: params.id, tenantId } })
  if (!contato) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  await prisma.whatsAppContato.update({ where: { id: params.id }, data: { ativo: false } })
  return NextResponse.json({ ok: true })
}
