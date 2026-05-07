import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'

export async function GET(req: Request) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, Number(searchParams.get('page') ?? 1))
  const limit = 50

  try {
    const [logs, total] = await Promise.all([
      prisma.adminLog.findMany({
        include: { admin: { select: { email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.adminLog.count(),
    ])

    return NextResponse.json({ logs, total, page, pages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('[ADMIN LOGS]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
