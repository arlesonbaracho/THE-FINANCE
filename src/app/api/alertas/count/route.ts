import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'

export async function GET() {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  try {
    const count = await prisma.alert.count({
      where: { tenantId, status: 'NAO_LIDO' },
    })

    return NextResponse.json({ count })
  } catch (error) {
    console.error('[ALERTAS COUNT GET]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
