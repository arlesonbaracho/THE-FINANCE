import { prisma } from '@/lib/prisma'
import { startOfMonth, endOfMonth, subMonths, addMonths, format } from 'date-fns'

export interface MRRData {
  total: number
  porPlano: Record<string, number>
}

export interface ChurnData {
  churnRate: number
  cancelamentos: number
  ativosInicio: number
}

export interface ProjecaoData {
  mes: string
  mrr: number
  mrrMin: number
  mrrMax: number
}

export async function calcularMRR(): Promise<MRRData> {
  const subs = await prisma.tenantSubscription.findMany({
    where: { status: 'ACTIVE' },
    select: { planId: true, contractedPrice: true },
  })

  const porPlano: Record<string, number> = {}
  let total = 0
  for (const s of subs) {
    porPlano[s.planId] = (porPlano[s.planId] ?? 0) + s.contractedPrice
    total += s.contractedPrice
  }

  return { total, porPlano }
}

export async function historicMRR(meses: number) {
  return prisma.saasMetricsSnapshot.findMany({
    orderBy: { data: 'desc' },
    take: meses,
  })
}

export async function calcularChurn(mes: number, ano: number): Promise<ChurnData> {
  const inicioMes = startOfMonth(new Date(ano, mes - 1))
  const fimMes = endOfMonth(inicioMes)

  const [cancelamentos, ativosInicio] = await Promise.all([
    prisma.tenantSubscription.count({
      where: { status: 'CANCELLED', updatedAt: { gte: inicioMes, lte: fimMes } },
    }),
    prisma.tenantSubscription.count({
      where: { status: 'ACTIVE', startDate: { lt: inicioMes } },
    }),
  ])

  const churnRate = ativosInicio > 0 ? (cancelamentos / ativosInicio) * 100 : 0
  return { churnRate, cancelamentos, ativosInicio }
}

export async function calcularLTV(): Promise<number> {
  const subs = await prisma.tenantSubscription.findMany({
    select: { contractedPrice: true, startDate: true, status: true },
  })
  if (subs.length === 0) return 0

  const mrrMedio = subs.reduce((s, sub) => s + sub.contractedPrice, 0) / subs.length
  const agora = new Date()
  const retencaoMeses =
    subs.reduce((s, sub) => {
      const meses = (agora.getTime() - sub.startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
      return s + Math.max(1, meses)
    }, 0) / subs.length

  return mrrMedio * retencaoMeses
}

export async function calcularNRR(mes: number, ano: number): Promise<number> {
  const inicioMes = startOfMonth(new Date(ano, mes - 1))
  const fimMes = endOfMonth(inicioMes)

  const subsInicio = await prisma.tenantSubscription.findMany({
    where: { status: 'ACTIVE', startDate: { lt: inicioMes } },
    select: { tenantId: true, contractedPrice: true },
  })
  const mrrInicio = subsInicio.reduce((s, sub) => s + sub.contractedPrice, 0)
  if (mrrInicio === 0) return 100

  const historico = await prisma.planHistory.findMany({
    where: { createdAt: { gte: inicioMes, lte: fimMes } },
    include: { tenant: { include: { subscription: true } } },
  })

  let expansao = 0
  let contracao = 0
  for (const h of historico) {
    const priceAtual = h.tenant.subscription?.contractedPrice ?? 0
    const wasActive = subsInicio.some((s) => s.tenantId === h.tenantId)
    if (!wasActive) continue
    const prevPrice = subsInicio.find((s) => s.tenantId === h.tenantId)?.contractedPrice ?? 0
    if (priceAtual > prevPrice) expansao += priceAtual - prevPrice
    if (priceAtual < prevPrice) contracao += prevPrice - priceAtual
  }

  return ((mrrInicio + expansao - contracao) / mrrInicio) * 100
}

export async function cohortAnalysis(): Promise<Array<{ cohort: string; retencao: number[] }>> {
  const dozeAtras = subMonths(new Date(), 12)

  const tenants = await prisma.tenantSubscription.findMany({
    where: { startDate: { gte: dozeAtras } },
    select: { tenantId: true, startDate: true, status: true },
    orderBy: { startDate: 'asc' },
  })

  const cohortMap = new Map<string, Array<{ tenantId: string; startDate: Date; status: string }>>()
  for (const t of tenants) {
    const key = format(t.startDate, 'yyyy-MM')
    const cur = cohortMap.get(key) ?? []
    cur.push(t)
    cohortMap.set(key, cur)
  }

  const agora = new Date()
  const result: Array<{ cohort: string; retencao: number[] }> = []

  for (const [cohort, membros] of Array.from(cohortMap.entries())) {
    const cohortDate = new Date(cohort + '-01')
    const maxMeses = Math.floor((agora.getTime() - cohortDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
    const retencao: number[] = []

    for (let mes = 0; mes <= Math.min(maxMeses, 11); mes++) {
      const refDate = addMonths(cohortDate, mes)
      const ativos = membros.filter(
        (m: { startDate: Date; status: string }) => m.startDate <= refDate && m.status !== 'CANCELLED'
      ).length
      retencao.push(membros.length > 0 ? Math.round((ativos / membros.length) * 100) : 0)
    }

    result.push({ cohort, retencao })
  }

  return result
}

export async function projecaoReceita(meses: number): Promise<ProjecaoData[]> {
  const snapshots = await prisma.saasMetricsSnapshot.findMany({
    orderBy: { data: 'asc' },
    take: 3,
  })

  if (snapshots.length < 2) {
    const mrrAtual = (await calcularMRR()).total
    return Array.from({ length: meses }, (_, i) => ({
      mes: format(addMonths(new Date(), i + 1), 'yyyy-MM'),
      mrr: mrrAtual,
      mrrMin: Math.round(mrrAtual * 0.85),
      mrrMax: Math.round(mrrAtual * 1.15),
    }))
  }

  const taxas: number[] = []
  for (let i = 1; i < snapshots.length; i++) {
    const prev = Number(snapshots[i - 1].mrr)
    const cur = Number(snapshots[i].mrr)
    if (prev > 0) taxas.push((cur - prev) / prev)
  }
  const taxaMedia = taxas.reduce((s, t) => s + t, 0) / taxas.length

  let mrrBase = Number(snapshots[snapshots.length - 1].mrr)
  const ultimaData = snapshots[snapshots.length - 1].data
  const projecoes: ProjecaoData[] = []

  for (let i = 1; i <= meses; i++) {
    mrrBase = mrrBase * (1 + taxaMedia)
    projecoes.push({
      mes: format(addMonths(ultimaData, i), 'yyyy-MM'),
      mrr: Math.round(mrrBase),
      mrrMin: Math.round(mrrBase * 0.85),
      mrrMax: Math.round(mrrBase * 1.15),
    })
  }

  return projecoes
}

export async function salvarSaasSnapshot(): Promise<void> {
  const hoje = startOfMonth(new Date())
  const now = new Date()
  const [mrrData, { churnRate }, totalTenants, tenantAtivos] = await Promise.all([
    calcularMRR(),
    calcularChurn(now.getMonth() + 1, now.getFullYear()),
    prisma.tenant.count({ where: { deletedAt: null } }),
    prisma.tenantSubscription.count({ where: { status: 'ACTIVE' } }),
  ])

  await prisma.saasMetricsSnapshot.upsert({
    where: { data: hoje },
    create: {
      data: hoje,
      mrr: mrrData.total,
      mrrPorPlano: mrrData.porPlano,
      churnRate,
      tenantCount: totalTenants,
      tenantAtivos,
    },
    update: {
      mrr: mrrData.total,
      mrrPorPlano: mrrData.porPlano,
      churnRate,
      tenantCount: totalTenants,
      tenantAtivos,
    },
  })
}
