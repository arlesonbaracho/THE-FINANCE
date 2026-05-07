import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'

export async function GET(req: Request) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')?.slice(0, 100)
  const status = searchParams.get('status')
  const planId = searchParams.get('planId')

  try {
    const tenants = await prisma.tenant.findMany({
      where: {
        deletedAt: null,
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { users: { some: { email: { contains: search, mode: 'insensitive' } } } },
          ],
        }),
        ...(status && { subscription: { status: status as never } }),
        ...(planId && { subscription: { planId } }),
      },
      include: {
        subscription: { include: { plan: true } },
        users: { where: { role: 'ADMIN' }, take: 1, select: { name: true, email: true } },
        _count: { select: { products: true, ingredients: true, users: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    return NextResponse.json(tenants)
  } catch (error) {
    console.error('[ADMIN TENANTS GET]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
