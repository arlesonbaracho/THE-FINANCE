import { Queue, Worker } from 'bullmq'
import { redisConnectionOptions } from '@/lib/bullmq'
import type { Server as SocketIOServer } from 'socket.io'
import { processNfJob } from './nf-processor.job'
import { resetAiUsage } from './ai-usage-reset.job'

export async function startAiWorkers(io: SocketIOServer): Promise<void> {
  new Worker('nf-processing', (job) => processNfJob(job, io), {
    connection: redisConnectionOptions,
  })

  const resetQueue = new Queue('ai-usage-reset', { connection: redisConnectionOptions })
  await resetQueue.add(
    'monthly-reset',
    {},
    { repeat: { pattern: '0 0 1 * *' }, jobId: 'ai-usage-reset-monthly' }
  )
  new Worker('ai-usage-reset', () => resetAiUsage(), {
    connection: redisConnectionOptions,
  })

  console.log('> AI workers started')
}
