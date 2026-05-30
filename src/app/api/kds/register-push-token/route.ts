import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const schema = z.object({
  token: z.string().min(1),
  plataforma: z.enum(['ANDROID', 'IOS']),
  nomeDispositivo: z.string().min(1),
  tenantId: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 }
    )
  }

  const { token, plataforma, nomeDispositivo, tenantId } = parsed.data

  try {
    await prisma.kdsDevice.upsert({
      where: { pushToken: token },
      create: { tenantId, pushToken: token, plataforma, nomeDispositivo },
      update: { tenantId, plataforma, nomeDispositivo },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[kds/register-push-token]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
