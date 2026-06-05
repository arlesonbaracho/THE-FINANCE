import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      ifoodIntegracao: {
        select: { status: true, ultimaSincronizacao: true, merchantId: true },
      },
      whatsappContatos: {
        select: { updatedAt: true },
        take: 1,
        orderBy: { updatedAt: 'desc' },
      },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(tenants)
}
