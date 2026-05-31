import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'

export async function GET(req: NextRequest) {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  const { searchParams } = req.nextUrl
  const fornecedor = searchParams.get('fornecedor')
  const origem = searchParams.get('origem') as 'UPLOAD_IMAGEM' | 'UPLOAD_PDF' | 'TEXTO' | null
  const de = searchParams.get('de')
  const ate = searchParams.get('ate')

  const nfs = await prisma.nfProcessada.findMany({
    where: {
      tenantId,
      status: 'CONCLUIDA',
      ...(fornecedor && { fornecedorNome: { contains: fornecedor, mode: 'insensitive' } }),
      ...(origem && { origem }),
      ...(de && ate && { createdAt: { gte: new Date(de), lte: new Date(ate) } }),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      createdAt: true,
      fornecedorNome: true,
      numeroNf: true,
      itensCriados: true,
      valorTotal: true,
      processadoPor: true,
      origem: true,
      cloudinaryUrl: true,
    },
  })

  return NextResponse.json(nfs)
}
