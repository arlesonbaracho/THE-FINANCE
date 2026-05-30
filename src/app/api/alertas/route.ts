import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'
import { TipoAlerta, StatusAlerta } from '@prisma/client'

export async function GET(req: NextRequest) {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  try {
    const { searchParams } = req.nextUrl
    const tipo = searchParams.get('tipo') as TipoAlerta | null
    const status = searchParams.get('status') as StatusAlerta | null
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))
    const busca = searchParams.get('busca') ?? ''
    const skip = (page - 1) * limit

    const where = {
      tenantId,
      ...(tipo ? { tipo } : {}),
      ...(status ? { status } : {}),
      ...(busca ? { titulo: { contains: busca, mode: 'insensitive' as const } } : {}),
    }

    const [items, total] = await Promise.all([
      prisma.alert.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip,
        take: limit,
      }),
      prisma.alert.count({ where }),
    ])

    return NextResponse.json({ items, total, page, limit, pages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('[ALERTAS GET]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
