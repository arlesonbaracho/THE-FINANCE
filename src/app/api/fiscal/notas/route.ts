import { NextResponse } from 'next/server'
import { getSession, unauthorizedResponse } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  const notas = await prisma.nfProcessada.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true, origem: true, tipo: true, status: true, numeroNf: true,
      fornecedorNome: true, valorTotal: true, dataEmissao: true, modelo: true,
      importadoEstoqueEm: true, createdAt: true,
    },
  })
  return NextResponse.json(notas)
}
