import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId')
  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId é obrigatório' }, { status: 400 })
  }

  try {
    const cozinheiros = await prisma.user.findMany({
      where: { tenantId, status: 'ACTIVE' },
      select: { id: true, name: true, avatarUrl: true },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(cozinheiros)
  } catch (error) {
    console.error('[kds/cozinheiros]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
