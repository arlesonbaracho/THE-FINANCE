import { prisma } from '@/lib/prisma'
import type { Brand } from '@prisma/client'
import type { FiltroPeriodo, KpisConsolidados, KpiUnidade } from './types'

interface CriarBrandDados {
  nome: string
  slug: string
  planId: string
  logoUrl?: string
}

export async function criarBrand(adminUserId: string, dados: CriarBrandDados): Promise<Brand> {
  return prisma.brand.create({
    data: {
      nome: dados.nome,
      slug: dados.slug,
      logoUrl: dados.logoUrl,
      planId: dados.planId,
      adminUserId,
    },
  })
}

export async function adicionarUnidade(brandId: string, tenantId: string): Promise<void> {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { brandId },
  })
}

export async function removerUnidade(brandId: string, tenantId: string): Promise<void> {
  await prisma.tenant.update({
    where: { id: tenantId, brandId },
    data: { brandId: null, isHeadquarters: false },
  })
}

export async function listarUnidades(brandId: string) {
  return prisma.tenant.findMany({
    where: { brandId },
    select: { id: true, name: true, active: true, isHeadquarters: true },
    orderBy: [{ isHeadquarters: 'desc' }, { name: 'asc' }],
  })
}

export async function buscarKpisConsolidados(
  brandId: string,
  filtro: FiltroPeriodo
): Promise<KpisConsolidados> {
  const unidades = await prisma.tenant.findMany({
    where: { brandId },
    select: { id: true, name: true },
  })

  const tenantIds = unidades.map((u) => u.id)

  const [snapshots, alertCounts] = await Promise.all([
    prisma.dashboardSnapshot.findMany({
      where: {
        tenantId: { in: tenantIds },
        data: { gte: filtro.inicio, lte: filtro.fim },
      },
    }),
    Promise.all(
      tenantIds.map((id) =>
        prisma.alert
          .count({ where: { tenantId: id, status: 'NAO_LIDO' } })
          .then((count) => ({ tenantId: id, count }))
      )
    ),
  ])

  // Agregar por unidade
  const porUnidadeMap = new Map<string, { vendas: number; pedidos: number; cmvSum: number; days: number }>()
  for (const s of snapshots) {
    const cur = porUnidadeMap.get(s.tenantId) ?? { vendas: 0, pedidos: 0, cmvSum: 0, days: 0 }
    cur.vendas += Number(s.totalVendas)
    cur.pedidos += s.totalPedidos
    cur.cmvSum += Number(s.cmvPercentual)
    cur.days += 1
    porUnidadeMap.set(s.tenantId, cur)
  }

  const alertMap = new Map(alertCounts.map((a) => [a.tenantId, a.count]))

  const porUnidade: KpiUnidade[] = unidades.map((u) => {
    const agg = porUnidadeMap.get(u.id)
    const vendas = agg?.vendas ?? 0
    const pedidos = agg?.pedidos ?? 0
    const cmvPercentual = agg && agg.days > 0 ? agg.cmvSum / agg.days : 0
    const ticketMedio = pedidos > 0 ? vendas / pedidos : 0
    return {
      tenantId: u.id,
      tenantName: u.name,
      totalVendas: vendas,
      totalPedidos: pedidos,
      ticketMedio,
      cmvPercentual,
      alertasAtivos: alertMap.get(u.id) ?? 0,
      ativo: true,
    }
  })

  const totalVendas = porUnidade.reduce((s, u) => s + u.totalVendas, 0)
  const totalPedidos = porUnidade.reduce((s, u) => s + u.totalPedidos, 0)
  const ticketMedio = totalPedidos > 0 ? totalVendas / totalPedidos : 0
  const cmvMedio =
    porUnidade.length > 0
      ? porUnidade.reduce((s, u) => s + u.cmvPercentual, 0) / porUnidade.length
      : 0

  const sorted = [...porUnidade].sort((a, b) => b.totalVendas - a.totalVendas)
  const melhorUnidade = sorted[0]?.totalVendas > 0 ? sorted[0] : null
  const unidadeAlerta = sorted.length > 1 ? sorted[sorted.length - 1] : null

  return {
    totalVendas,
    totalPedidos,
    ticketMedio,
    cmvMedio,
    melhorUnidade,
    unidadeAlerta,
    porUnidade,
    variacaoVendas: 0,
    variacaoPedidos: 0,
  }
}
