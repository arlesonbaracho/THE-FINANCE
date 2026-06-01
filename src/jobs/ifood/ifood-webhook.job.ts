import type { Job } from 'bullmq'
import { processarWebhook } from '@/services/integrations/ifood/ifood-orders.service'

type WebhookJobData = {
  tenantId: string
  payload: Record<string, unknown>
}

export async function processWebhookJob(job: Job<WebhookJobData>): Promise<void> {
  const { tenantId, payload } = job.data
  await processarWebhook(tenantId, payload as Parameters<typeof processarWebhook>[1])
  console.log(`[ifood-webhook] Pedido ${payload.id} processado para tenant ${tenantId}`)
}
