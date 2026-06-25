import { NextResponse } from 'next/server'
import { getSession, unauthorizedResponse } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export async function GET(_req: Request, props: { params: Promise<{ pedidoId: string }> }) {
  const params = await props.params;
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  const nf = await prisma.nfProcessada.findFirst({
    where: { pedidoId: params.pedidoId, tenantId: session.user.tenantId },
    select: { status: true, danfeUrl: true, chaveAcesso: true, motivoRejeicao: true },
  })
  return NextResponse.json(nf ?? { status: null })
}
