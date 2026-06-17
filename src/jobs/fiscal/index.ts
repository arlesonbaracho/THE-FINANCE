import { Worker, type Job } from 'bullmq'
import { redisConnectionOptions } from '@/lib/bullmq'
import { processNfCaptureJob } from './nf-capture.job'

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
