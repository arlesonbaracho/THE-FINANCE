import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import { calcularChurn, calcularLTV, calcularNRR } from '@/services/admin/saas-metrics.service'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const agora = new Date()
  const mes = parseInt(req.nextUrl.searchParams.get('mes') ?? String(agora.getMonth() + 1), 10)
  const ano = parseInt(req.nextUrl.searchParams.get('ano') ?? String(agora.getFullYear()), 10)

  const [churn, ltv, nrr, cacSettings] = await Promise.all([
    calcularChurn(mes, ano),
    calcularLTV(),
    calcularNRR(mes, ano),
    prisma.adminSettings.findUnique({ where: { chave: 'cac_mensal' } }),
  ])

  const mesKey = `${ano}-${String(mes).padStart(2, '0')}`
  const cac = cacSettings ? (cacSettings.valor as Record<string, number>)[mesKey] ?? null : null

  return NextResponse.json({ churn, ltv, nrr, cac })
}

export async function PATCH(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { mes, ano, cac } = await req.json()
  const mesKey = `${ano}-${String(mes).padStart(2, '0')}`

  const existing = await prisma.adminSettings.findUnique({ where: { chave: 'cac_mensal' } })
  const valorAtual = (existing?.valor as Record<string, number>) ?? {}
  valorAtual[mesKey] = cac

  await prisma.adminSettings.upsert({
    where: { chave: 'cac_mensal' },
    create: { chave: 'cac_mensal', valor: valorAtual },
    update: { valor: valorAtual },
  })

  return NextResponse.json({ ok: true })
}
