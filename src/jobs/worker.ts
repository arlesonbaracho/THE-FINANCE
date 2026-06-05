import { platformHealthQueue, saasMetricsQueue } from '@/lib/queues'
import { criarPlatformHealthWorker } from './admin/platform-health.job'
import { criarSaasMetricsWorker } from './admin/saas-metrics-snapshot.job'

async function iniciarWorker() {
  console.log('[worker] Iniciando workers BullMQ...')

  // Registrar jobs recorrentes (upsert para não duplicar em restart)
  await platformHealthQueue.upsertJobScheduler(
    'platform-health-cron',
    { pattern: '*/5 * * * *' },
    { name: 'platform-health', data: {} }
  )

  await saasMetricsQueue.upsertJobScheduler(
    'saas-metrics-daily',
    { pattern: '0 1 * * *' },
    { name: 'saas-metrics-snapshot', data: {} }
  )

  // Iniciar workers
  criarPlatformHealthWorker()
  criarSaasMetricsWorker()

  console.log('[worker] platform-health: a cada 5 minutos')
  console.log('[worker] saas-metrics-snapshot: diário às 01h')
  console.log('[worker] Workers iniciados com sucesso.')
}

iniciarWorker().catch((err) => {
  console.error('[worker] Erro ao iniciar:', err)
  process.exit(1)
})
