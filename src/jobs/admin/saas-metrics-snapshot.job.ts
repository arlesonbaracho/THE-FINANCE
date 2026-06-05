import { Worker, type Job } from 'bullmq'
import { redisConnectionOptions } from '@/lib/bullmq'
import { salvarSaasSnapshot } from '@/services/admin/saas-metrics.service'

export function criarSaasMetricsWorker() {
  const worker = new Worker(
    'saas-metrics-snapshot',
    async (_job: Job) => {
      await salvarSaasSnapshot()
    },
    { connection: redisConnectionOptions }
  )

  worker.on('failed', (job, err) => {
    console.error(`[saas-metrics-snapshot] Job ${job?.id} falhou:`, err.message)
  })

  return worker
}
