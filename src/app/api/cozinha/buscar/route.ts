import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json([])

  const tenants = await prisma.tenant.findMany({
    where: { name: { contains: q, mode: 'insensitive' } },
    select: { name: true, slug: true },
    take: 5,
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(tenants)
}
