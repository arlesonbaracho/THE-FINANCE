import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { subHours } from 'date-fns'

export async function GET(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const horas = parseInt(req.nextUrl.searchParams.get('horas') ?? '24', 10)
  const desde = subHours(new Date(), horas)

  const logs = await prisma.platformHealthLog.findMany({
    where: { tipo: 'API', registradoEm: { gte: desde } },
    select: { metrica: true, valor: true, status: true, registradoEm: true },
    orderBy: { registradoEm: 'asc' },
  })

  return NextResponse.json(logs)
}
