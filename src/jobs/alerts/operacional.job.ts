import { prisma } from '@/lib/prisma'
import type { Server as SocketIOServer } from 'socket.io'
import { antiSpamOperacional, createAlert, isInSilenceWindow } from './utils'

const OPERATIONAL_HOURS = { start: 6, end: 23 }

function isWithinOperationalHours(): boolean {
  const h = new Date().getHours()
  return h >= OPERATIONAL_HOURS.start && h < OPERATIONAL_HOURS.end
}

export async function processOperacionalAlerts(io: SocketIOServer): Promise<void> {
  if (!isWithinOperationalHours()) return

  const tenants = await prisma.tenant.findMany({
    where: { active: true, deletedAt: null },
    select: { id: true },
  })

  const now = new Date()
  const dezMinAtras = new Date(now.getTime() - 10 * 60 * 1000)
  const umaHoraAtras = new Date(now.getTime() - 60 * 60 * 1000)

  for (const { id: tenantId } of tenants) {
    const config = await prisma.alertConfig.findFirst({
      where: { tenantId, tipoAlerta: 'OPERACIONAL' },
    })
    if (config && !config.ativo) continue
    if (config && isInSilenceWindow(config as { horarioSilencioInicio?: string | null; horarioSilencioFim?: string | null })) continue

    const thresholdPedidosParados: number =
      config && typeof (config.threshold as Record<string, number>).pedidosParados === 'number'
        ? (config.threshold as Record<string, number>).pedidosParados
        : 5

    // 1. Pedidos parados na fila
    const pedidosParados = await prisma.pedido.count({
      where: {
        tenantId,
        status: 'ABERTO',
        criadoEm: { lte: dezMinAtras },
      },
    })
    if (pedidosParados >= thresholdPedidosParados) {
      if (!(await antiSpamOperacional(tenantId, 'PEDIDOS_PARADOS'))) {
        await createAlert({
          tenantId, tipo: 'OPERACIONAL', severidade: 'ALTA',
          titulo: `${pedidosParados} pedidos parados na fila da cozinha`,
          descricao: `${pedidosParados} pedidos com status "Aberto" sem movimentação por mais de 10 minutos.`,
          metadata: { subtipo: 'PEDIDOS_PARADOS', acao: 'Ver cozinha', qtd: pedidosParados },
        }, io)
      }
    }

    // 2. Alto volume de cancelamentos na última hora
    const cancelamentos = await prisma.pedido.count({
      where: {
        tenantId,
        status: 'CANCELADO',
        fechadoEm: { gte: umaHoraAtras },
      },
    })
    if (cancelamentos > 3) {
      if (!(await antiSpamOperacional(tenantId, 'CANCELAMENTOS'))) {
        await createAlert({
          tenantId, tipo: 'OPERACIONAL', severidade: 'ALTA',
          titulo: `Alto volume de cancelamentos — verificar operação`,
          descricao: `${cancelamentos} cancelamentos na última hora.`,
          metadata: { subtipo: 'CANCELAMENTOS', acao: 'Ver pedidos', qtd: cancelamentos },
        }, io)
      }
    }
  }
}
