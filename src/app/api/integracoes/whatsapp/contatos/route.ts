import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

function allowed(role?: string | null) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER'
}

const contatoSchema = z.object({
  nome: z.string().min(1).max(100).trim(),
  numero: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Número deve estar no formato E.164: +5511999999999'),
  permiteComandos: z.boolean().default(false),
  recebeAlertas: z.boolean().default(true),
  recebeResumoDiario: z.boolean().default(false),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId || !allowed(session.user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const contatos = await prisma.whatsAppContato.findMany({
    where: { tenantId: session.user.tenantId, ativo: true },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(contatos)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId || !allowed(session.user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const tenantId = session.user.tenantId

  const body = await req.json()
  const parsed = contatoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }

  const existing = await prisma.whatsAppContato.findUnique({
    where: { tenantId_numero: { tenantId, numero: parsed.data.numero } },
  })
  if (existing) {
    if (!existing.ativo) {
      const reactivated = await prisma.whatsAppContato.update({
        where: { id: existing.id },
        data: { ativo: true, ...parsed.data },
      })
      return NextResponse.json(reactivated)
    }
    return NextResponse.json({ error: 'Número já cadastrado' }, { status: 409 })
  }

  const contato = await prisma.whatsAppContato.create({ data: { tenantId, ...parsed.data } })
  return NextResponse.json(contato, { status: 201 })
}
