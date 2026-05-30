import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'
import { z } from 'zod'

const schema = z.object({
  tipo: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  emails: z.array(z.string().email()).min(1).max(10),
  ativo: z.boolean().optional().default(true),
})

export async function GET() {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  const schedules = await prisma.relatorioSchedule.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(schedules)
}

export async function POST(req: Request) {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  const { tipo, emails, ativo } = parsed.data

  // Upsert by tipo (one schedule per type per tenant)
  const existing = await prisma.relatorioSchedule.findFirst({ where: { tenantId, tipo } })
  let schedule
  if (existing) {
    schedule = await prisma.relatorioSchedule.update({
      where: { id: existing.id },
      data: { emails, ativo },
    })
  } else {
    schedule = await prisma.relatorioSchedule.create({
      data: { tenantId, tipo, emails, ativo },
    })
  }

  return NextResponse.json(schedule)
}

export async function DELETE(req: Request) {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

  await prisma.relatorioSchedule.deleteMany({ where: { id, tenantId } })
  return NextResponse.json({ ok: true })
}
