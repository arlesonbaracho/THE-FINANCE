import { Queue, Worker } from 'bullmq'
import { redisConnectionOptions } from '@/lib/bullmq'
import type { Server as SocketIOServer } from 'socket.io'
import { processWebhookJob } from './ifood-webhook.job'
import { processAutoConfirmJob } from './ifood-auto-confirm.job'
import { processCatalogSyncJob } from './ifood-catalog-sync.job'

export async function startIFoodWorkers(_io: SocketIOServer): Promise<void> {
  new Worker('ifood-webhook', processWebhookJob, {
    connection: redisConnectionOptions,
    concurrency: 5,
  })

  new Worker('ifood-auto-confirm', processAutoConfirmJob, {
    connection: redisConnectionOptions,
  })

  const syncQueue = new Queue('ifood-catalog-sync', { connection: redisConnectionOptions })
  await syncQueue.add(
    'catalog-sync',
    {},
    { repeat: { pattern: '*/30 * * * *' }, jobId: 'ifood-catalog-sync-cron' }
  )
  new Worker('ifood-catalog-sync', processCatalogSyncJob, {
    connection: redisConnectionOptions,
  })

  console.log('> iFood workers started')
}
