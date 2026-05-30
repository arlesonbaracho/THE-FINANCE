import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'

export async function GET() {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  try {
    const configs = await prisma.alertConfig.findMany({
      where: { tenantId },
      orderBy: { tipoAlerta: 'asc' },
    })

    return NextResponse.json(configs)
  } catch (error) {
    console.error('[ALERT CONFIGS GET]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
