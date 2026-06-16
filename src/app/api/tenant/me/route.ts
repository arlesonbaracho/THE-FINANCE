import { NextResponse } from 'next/server'
import { getSession, unauthorizedResponse } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  const t = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { cnpj: true, createdAt: true },
  })
  return NextResponse.json(t)
}
