import type { Job } from 'bullmq'
import { confirmarPedido } from '@/services/integrations/ifood/ifood-orders.service'
import { prisma } from '@/lib/prisma'

type AutoConfirmJobData = {
  tenantId: string
  ifoodOrderId: string
}

export async function processAutoConfirmJob(job: Job<AutoConfirmJobData>): Promise<void> {
  const { tenantId, ifoodOrderId } = job.data

  const ifoodPedido = await prisma.iFoodPedido.findUnique({ where: { ifoodOrderId } })
  if (!ifoodPedido) return
  if (ifoodPedido.statusIfood === 'CANCELLED' || ifoodPedido.statusIfood === 'REJECTED') return

  await confirmarPedido(tenantId, ifoodOrderId)
  await prisma.iFoodPedido.update({
    where: { ifoodOrderId },
    data: { statusIfood: 'CONFIRMED' },
  })
  console.log(`[ifood-auto-confirm] Pedido ${ifoodOrderId} confirmado automaticamente`)
}
