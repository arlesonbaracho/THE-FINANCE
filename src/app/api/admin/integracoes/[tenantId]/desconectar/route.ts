import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: { tenantId: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { integracao } = (await req.json()) as { integracao: 'ifood' | 'whatsapp' }

  if (integracao === 'ifood') {
    await prisma.iFoodIntegration.update({
      where: { tenantId: params.tenantId },
      data: {
        status: 'DESCONECTADO',
        accessToken: null,
        refreshToken: null,
        tokenExpiresAt: null,
      },
    })
    return NextResponse.json({ ok: true, integracao: 'ifood' })
  }

  if (integracao === 'whatsapp') {
    try {
      const envUrl = process.env.EVOLUTION_API_URL ?? 'http://localhost:8080'
      const apiKey = process.env.EVOLUTION_API_KEY ?? ''
      await fetch(`${envUrl}/instance/logout/${params.tenantId}`, {
        method: 'DELETE',
        headers: { apikey: apiKey },
      })
    } catch { /* Evolution pode estar offline */ }
    return NextResponse.json({ ok: true, integracao: 'whatsapp' })
  }

  return NextResponse.json({ error: 'integracao deve ser ifood ou whatsapp' }, { status: 400 })
}
