import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'
import { zodErrorResponse } from '@/lib/validations'
import { z } from 'zod'

const schema = z.object({
  status: z.enum(['LIDO', 'RESOLVIDO', 'IGNORADO']),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(zodErrorResponse(parsed.error), { status: 400 })
    }

    const { status } = parsed.data
    const data: Record<string, unknown> = { status }
    if (status === 'LIDO') data.lidoEm = new Date()
    if (status === 'RESOLVIDO') data.resolvidoEm = new Date()

    const result = await prisma.alert.updateMany({
      where: { id: params.id, tenantId },
      data,
    })

    if (result.count === 0) {
      return NextResponse.json({ error: 'Alerta não encontrado' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[ALERTAS PATCH]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
