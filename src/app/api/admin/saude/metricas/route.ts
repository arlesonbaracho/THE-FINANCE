import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const tipos = ['API', 'JOB', 'WEBHOOK', 'DATABASE', 'REDIS', 'AI'] as const
  const metricas = await Promise.all(
    tipos.map((tipo) =>
      prisma.platformHealthLog
        .findFirst({ where: { tipo }, orderBy: { registradoEm: 'desc' } })
        .then((log) => ({ tipo, log }))
    )
  )

  const alertas = await prisma.adminNotification.findMany({
    where: { resolvido: false },
    orderBy: { criadoEm: 'desc' },
    take: 50,
  })

  return NextResponse.json({ metricas, alertas })
}
