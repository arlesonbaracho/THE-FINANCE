import { Worker, type Job } from 'bullmq'
import { redisConnectionOptions } from '@/lib/bullmq'
import { processExpurgoJob } from './expurgo.job'

export function criarExpurgoWorker() {
  const worker = new Worker(
    'lgpd-expurgo',
    async (_job: Job) => {
      await processExpurgoJob()
    },
    { connection: redisConnectionOptions },
  )
  worker.on('failed', (job, err) => {
    console.error(`[lgpd-expurgo] Job ${job?.id} falhou:`, err.message)
  })
  return worker
}
