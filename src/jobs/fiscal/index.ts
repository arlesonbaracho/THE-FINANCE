import { Worker, type Job } from 'bullmq'
import { redisConnectionOptions } from '@/lib/bullmq'
import { processNfCaptureJob } from './nf-capture.job'
import { processNfceRetryJob } from './nfce-retry.job'

export function criarNfCaptureWorker() {
  const worker = new Worker(
    'nf-capture',
    async (_job: Job) => {
      await processNfCaptureJob()
    },
    { connection: redisConnectionOptions }
  )

  worker.on('failed', (job, err) => {
    console.error(`[nf-capture] Job ${job?.id} falhou:`, err.message)
  })

  return worker
}

export function criarNfceRetryWorker() {
  const worker = new Worker(
    'nfce-retry',
    async (_job: Job) => {
      await processNfceRetryJob()
    },
    { connection: redisConnectionOptions }
  )

  worker.on('failed', (job, err) => {
    console.error(`[nfce-retry] Job ${job?.id} falhou:`, err.message)
  })

  return worker
}
