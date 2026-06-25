import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'

export async function GET(_req: Request, props: { params: Promise<{ nfId: string }> }) {
  const params = await props.params;
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  const nf = await prisma.nfProcessada.findFirst({
    where: { id: params.nfId, tenantId },
    select: { status: true, rawResponseIa: true },
  })

  if (!nf) return NextResponse.json({ error: 'NF não encontrada' }, { status: 404 })

  return NextResponse.json({
    status: nf.status,
    ...(nf.status === 'CONCLUIDA' && { dados: nf.rawResponseIa }),
    ...(nf.status === 'ERRO' && { erro: (nf.rawResponseIa as { erro?: string })?.erro }),
  })
}
