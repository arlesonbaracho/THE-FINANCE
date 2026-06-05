import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const usages = await prisma.aiUsage.findMany({
    include: {
      tenant: { include: { subscription: { include: { plan: true } } } },
    },
    orderBy: { custoEstimado: 'desc' },
  })

  return NextResponse.json(usages)
}
