import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'
import { logAdminAction } from '@/lib/admin-logger'
import { getClientIp } from '@/lib/rate-limit'
import { z } from 'zod'

const invoiceSchema = z.object({
  tenantId: z.string().cuid(),
  planId: z.string().cuid(),
  amount: z.number().min(0).max(99_999),
  dueDate: z.string().datetime(),
})

export async function GET(req: Request) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const tenantId = searchParams.get('tenantId')

  try {
    const invoices = await prisma.invoice.findMany({
      where: { ...(tenantId && { tenantId }) },
      include: { tenant: { select: { name: true } }, plan: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json(invoices)
  } catch (error) {
    console.error('[ADMIN INVOICES GET]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const body = await req.json()
    const parsed = invoiceSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
    }

    const invoice = await prisma.invoice.create({
      data: {
        ...parsed.data,
        dueDate: new Date(parsed.data.dueDate),
        status: 'PENDING',
      },
    })

    await logAdminAction({
      adminId: session.sub,
      action: 'CREATE_INVOICE',
      details: { tenantId: parsed.data.tenantId, amount: parsed.data.amount },
      ip: getClientIp(req),
    })

    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    console.error('[ADMIN INVOICES POST]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
