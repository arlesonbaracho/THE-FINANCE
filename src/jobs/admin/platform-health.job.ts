import { Worker, type Job } from 'bullmq'
import { redisConnectionOptions } from '@/lib/bullmq'
import { coletarMetricas, salvarSnapshot } from '@/services/admin/platform-health.service'

export function criarPlatformHealthWorker() {
  const worker = new Worker(
    'platform-health',
    async (_job: Job) => {
      const metricas = await coletarMetricas()
      await salvarSnapshot(metricas)
    },
    { connection: redisConnectionOptions }
  )

  worker.on('failed', (job, err) => {
    console.error(`[platform-health] Job ${job?.id} falhou:`, err.message)
  })

  return worker
}
