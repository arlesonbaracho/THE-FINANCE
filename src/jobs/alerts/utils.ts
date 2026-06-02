import { prisma } from '@/lib/prisma'
import { Prisma, TipoAlerta, Severidade } from '@prisma/client'
import type { Server as SocketIOServer } from 'socket.io'

export type CreateAlertPayload = {
  tenantId: string
  tipo: TipoAlerta
  severidade: Severidade
  titulo: string
  descricao: string
  insumoId?: string
  produtoId?: string
  metadata: Prisma.InputJsonValue
}

export function buildAlertTitulo(template: string, nome: string): string {
  return template.replace('[Insumo]', nome).replace('[Produto]', nome)
}

export function isInSilenceWindow(config: {
  horarioSilencioInicio?: string | null
  horarioSilencioFim?: string | null
}): boolean {
  if (!config.horarioSilencioInicio || !config.horarioSilencioFim) return false
  const now = new Date()
  const cur = now.getHours() * 60 + now.getMinutes()
  const [sh, sm] = config.horarioSilencioInicio.split(':').map(Number)
  const [eh, em] = config.horarioSilencioFim.split(':').map(Number)
  const start = sh * 60 + sm
  const end = eh * 60 + em
  if (start <= end) return cur >= start && cur < end
  return cur >= start || cur < end // cruza meia-noite
}

export async function antiSpamEstoque(
  tenantId: string,
  insumoId: string,
): Promise<boolean> {
  const existing = await prisma.alert.findFirst({
    where: {
      tenantId,
      tipo: 'ESTOQUE',
      insumoId,
      status: { in: ['NAO_LIDO', 'LIDO'] },
    },
    select: { id: true },
  })
  return !!existing
}

export async function antiSpamFinanceiro(
  tenantId: string,
  subtipo: string,
): Promise<boolean> {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const existing = await prisma.alert.findFirst({
    where: {
      tenantId,
      tipo: 'FINANCEIRO',
      status: { in: ['NAO_LIDO', 'LIDO'] },
      criadoEm: { gte: startOfDay },
      metadata: { path: ['subtipo'], equals: subtipo },
    },
    select: { id: true },
  })
  return !!existing
}

export async function antiSpamOperacional(
  tenantId: string,
  subtipo: string,
): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const existing = await prisma.alert.findFirst({
    where: {
      tenantId,
      tipo: 'OPERACIONAL',
      status: { in: ['NAO_LIDO', 'LIDO'] },
      criadoEm: { gte: oneHourAgo },
      metadata: { path: ['subtipo'], equals: subtipo },
    },
    select: { id: true },
  })
  return !!existing
}

export async function createAlert(
  payload: CreateAlertPayload,
  io: SocketIOServer,
): Promise<void> {
  let alert
  try {
    alert = await prisma.alert.create({
      data: {
        tenantId: payload.tenantId,
        tipo: payload.tipo,
        severidade: payload.severidade,
        titulo: payload.titulo,
        descricao: payload.descricao,
        insumoId: payload.insumoId,
        produtoId: payload.produtoId,
        metadata: payload.metadata,
        status: 'NAO_LIDO',
      },
    })
  } catch (err) {
    console.error('[createAlert] Failed to persist alert:', err)
    return
  }
  try {
    io.to(payload.tenantId).emit('alerta:novo', alert)
  } catch (err) {
    console.error('[createAlert] Failed to emit socket event:', err)
  }

  // Notificação WhatsApp (fire-and-forget)
  if (payload.severidade === 'CRITICA' || payload.severidade === 'ALTA') {
    import('@/services/integrations/whatsapp/whatsapp-messages.service')
      .then(({ enviarAlerta }) => enviarAlerta(payload.tenantId, {
        tenantId: payload.tenantId,
        tipo: payload.tipo,
        severidade: payload.severidade,
        titulo: payload.titulo,
        descricao: payload.descricao,
        metadata: payload.metadata as Record<string, unknown>,
      }))
      .catch((err) => console.error('[whatsapp] enviarAlerta failed:', err))
  }
}
