import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorizedResponse } from '@/lib/session'

export async function GET() {
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  const tenantId = session.user.tenantId as string
  const userId = (session.user as { id: string }).id

  const messages = await prisma.chatMessage.findMany({
    where: { tenantId, userId },
    orderBy: { createdAt: 'asc' },
    take: 30,
    select: { role: true, content: true, createdAt: true },
  })

  return NextResponse.json(messages)
}
