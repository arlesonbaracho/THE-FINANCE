import { prisma } from '@/lib/prisma'
import type { Server as SocketIOServer } from 'socket.io'
import { antiSpamFinanceiro, createAlert, isInSilenceWindow } from './utils'

const BENCHMARK = parseFloat(process.env.DEFAULT_CMV_BENCHMARK ?? '35')

export async function processFinanceiroAlerts(io: SocketIOServer): Promise<void> {
  const tenants = await prisma.tenant.findMany({
    where: { active: true, deletedAt: null },
    select: { id: true },
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (const { id: tenantId } of tenants) {
    const config = await prisma.alertConfig.findFirst({
      where: { tenantId, tipoAlerta: 'FINANCEIRO' },
    })
    if (config && !config.ativo) continue
    if (config && isInSilenceWindow(config as { horarioSilencioInicio?: string | null; horarioSilencioFim?: string | null })) continue

    const pedidosHoje = await prisma.pedido.findMany({
      where: { tenantId, status: 'FINALIZADO', fechadoEm: { gte: today } },
      select: { total: true, subtotal: true },
    })

    if (pedidosHoje.length === 0) continue

    const totalVendas = pedidosHoje.reduce((s, p) => s + p.total, 0)
    const totalPedidos = pedidosHoje.length
    const ticketMedio = totalVendas / totalPedidos

    const movimentacoesHoje = await prisma.ingredientMovement.findMany({
      where: { tenantId, type: 'OUT', createdAt: { gte: today } },
      select: { totalCost: true },
    })
    const cmvTotal = movimentacoesHoje.reduce((s, m) => s + (m.totalCost ?? 0), 0)
    const cmvPercentual = totalVendas > 0 ? (cmvTotal / totalVendas) * 100 : 0

    // 1. CMV acima de 38%
    if (cmvPercentual > 38) {
      if (!(await antiSpamFinanceiro(tenantId, 'CMV_ELEVADO'))) {
        await createAlert({
          tenantId, tipo: 'FINANCEIRO', severidade: 'ALTA',
          titulo: `CMV elevado hoje: ${cmvPercentual.toFixed(1)}% (benchmark: ${BENCHMARK}%)`,
          descricao: `CMV do dia: R$ ${cmvTotal.toFixed(2)} sobre R$ ${totalVendas.toFixed(2)} em vendas.`,
          metadata: { subtipo: 'CMV_ELEVADO', acao: 'Ver relatório CMV', cmvPercentual, benchmark: BENCHMARK },
        }, io)
      }
    }

    // 2. CMV elevado por 3 dias consecutivos
    const ultimos3 = await prisma.dashboardSnapshot.findMany({
      where: { tenantId },
      orderBy: { data: 'desc' },
      take: 3,
      select: { cmvPercentual: true },
    })
    if (ultimos3.length === 3 && ultimos3.every((s) => Number(s.cmvPercentual) > BENCHMARK)) {
      if (!(await antiSpamFinanceiro(tenantId, 'CMV_CONSECUTIVO'))) {
        await createAlert({
          tenantId, tipo: 'FINANCEIRO', severidade: 'CRITICA',
          titulo: `CMV acima do benchmark por 3 dias consecutivos`,
          descricao: `Médias: ${ultimos3.map((s) => `${Number(s.cmvPercentual).toFixed(1)}%`).join(', ')}.`,
          metadata: { subtipo: 'CMV_CONSECUTIVO', acao: 'Ver relatório CMV' },
        }, io)
      }
    }

    // 3. Queda de vendas vs média 7 dias
    const seteDiasAtras = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    const snapshotsRecentes = await prisma.dashboardSnapshot.findMany({
      where: { tenantId, data: { gte: seteDiasAtras, lt: today } },
      select: { totalVendas: true },
    })
    if (snapshotsRecentes.length >= 3) {
      const mediaVendas = snapshotsRecentes.reduce((s, snap) => s + Number(snap.totalVendas), 0) / snapshotsRecentes.length
      if (totalVendas < mediaVendas * 0.7) {
        const quedaPct = Math.round((1 - totalVendas / mediaVendas) * 100)
        if (!(await antiSpamFinanceiro(tenantId, 'QUEDA_VENDAS'))) {
          await createAlert({
            tenantId, tipo: 'FINANCEIRO', severidade: 'ALTA',
            titulo: `Vendas ${quedaPct}% abaixo da média desta semana`,
            descricao: `Vendas hoje: R$ ${totalVendas.toFixed(2)}. Média 7 dias: R$ ${mediaVendas.toFixed(2)}.`,
            metadata: { subtipo: 'QUEDA_VENDAS', acao: 'Ver relatório de vendas', quedaPct },
          }, io)
        }
      }
    }

    // 4. Meta diária atingida
    const metaDiaria = config && typeof (config.threshold as Record<string, number>).metaDiaria === 'number'
      ? (config.threshold as Record<string, number>).metaDiaria
      : null
    if (metaDiaria && totalVendas >= metaDiaria) {
      if (!(await antiSpamFinanceiro(tenantId, 'META_ATINGIDA'))) {
        await createAlert({
          tenantId, tipo: 'FINANCEIRO', severidade: 'INFO',
          titulo: `Meta do dia atingida! R$ ${totalVendas.toFixed(2)} vendidos`,
          descricao: `Meta: R$ ${metaDiaria.toFixed(2)}. Parabéns!`,
          metadata: { subtipo: 'META_ATINGIDA', acao: 'Ver relatório', totalVendas, meta: metaDiaria },
        }, io)
      }
    }

    // 5. Ticket médio em queda
    const trintaDiasAtras = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
    const [snapshots3, snapshots30] = await Promise.all([
      prisma.dashboardSnapshot.findMany({
        where: { tenantId, data: { gte: seteDiasAtras } },
        orderBy: { data: 'desc' },
        take: 3,
        select: { ticketMedio: true },
      }),
      prisma.dashboardSnapshot.findMany({
        where: { tenantId, data: { gte: trintaDiasAtras } },
        select: { ticketMedio: true },
      }),
    ])
    if (snapshots3.length === 3 && snapshots30.length >= 7) {
      const media3 = snapshots3.reduce((s, snap) => s + Number(snap.ticketMedio), 0) / 3
      const media30 = snapshots30.reduce((s, snap) => s + Number(snap.ticketMedio), 0) / snapshots30.length
      if (media3 < media30 * 0.85) {
        if (!(await antiSpamFinanceiro(tenantId, 'TICKET_QUEDA'))) {
          await createAlert({
            tenantId, tipo: 'FINANCEIRO', severidade: 'MEDIA',
            titulo: `Ticket médio em queda nos últimos 3 dias`,
            descricao: `Ticket médio 3 dias: R$ ${media3.toFixed(2)}. Média 30 dias: R$ ${media30.toFixed(2)}.`,
            metadata: { subtipo: 'TICKET_QUEDA', acao: 'Ver relatório', media3, media30 },
          }, io)
        }
      }
    }
  }
}
