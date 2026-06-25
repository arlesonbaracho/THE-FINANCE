import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'
import { zodErrorResponse } from '@/lib/validations'
import { z } from 'zod'

const schema = z.object({
  ativo: z.boolean().optional(),
  threshold: z.record(z.string(), z.unknown()).optional(),
  canais: z
    .object({
      sistema: z.boolean(),
      email: z.array(z.string()),
      whatsapp: z.array(z.string()),
    })
    .optional(),
  horarioSilencioInicio: z.string().nullable().optional(),
  horarioSilencioFim: z.string().nullable().optional(),
})

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(zodErrorResponse(parsed.error), { status: 400 })
    }

    const result = await prisma.alertConfig.updateMany({
      where: { id: params.id, tenantId },
      data: parsed.data as Record<string, unknown>,
    })

    if (result.count === 0) {
      return NextResponse.json({ error: 'Configuração não encontrada' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[ALERT CONFIGS PATCH]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
