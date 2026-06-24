import { platformHealthQueue, saasMetricsQueue, nfCaptureQueue, nfceRetryQueue, expurgoQueue } from '@/lib/queues'
import { criarPlatformHealthWorker } from './admin/platform-health.job'
import { criarSaasMetricsWorker } from './admin/saas-metrics-snapshot.job'
import { criarNfCaptureWorker, criarNfceRetryWorker } from './fiscal/index'
import { criarExpurgoWorker } from './lgpd/index'

const NF_CAPTURE_INTERVAL_HOURS = parseInt(process.env.NF_CAPTURE_INTERVAL_HOURS ?? '6', 10)
const NFCE_RETRY_INTERVAL_MIN = parseInt(process.env.NFCE_RETRY_INTERVAL_MIN ?? '15', 10)
const EXPURGO_INTERVAL_HOURS = parseInt(process.env.EXPURGO_INTERVAL_HOURS ?? '24', 10)

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

  await nfCaptureQueue.upsertJobScheduler(
    'nf-capture-cron',
    { pattern: `0 */${NF_CAPTURE_INTERVAL_HOURS} * * *` },
    { name: 'nf-capture', data: {} }
  )

  await nfceRetryQueue.upsertJobScheduler(
    'nfce-retry-cron',
    { pattern: `*/${NFCE_RETRY_INTERVAL_MIN} * * * *` },
    { name: 'nfce-retry', data: {} }
  )

  await expurgoQueue.upsertJobScheduler(
    'lgpd-expurgo-cron',
    { pattern: `0 */${EXPURGO_INTERVAL_HOURS} * * *` },
    { name: 'lgpd-expurgo', data: {} }
  )

  // Iniciar workers
  criarPlatformHealthWorker()
  criarSaasMetricsWorker()
  criarNfCaptureWorker()
  criarNfceRetryWorker()
  criarExpurgoWorker()

  console.log('[worker] platform-health: a cada 5 minutos')
  console.log('[worker] saas-metrics-snapshot: diário às 01h')
  console.log(`[worker] nf-capture: a cada ${NF_CAPTURE_INTERVAL_HOURS}h`)
  console.log(`[worker] nfce-retry: a cada ${NFCE_RETRY_INTERVAL_MIN} minutos`)
  console.log(`[worker] lgpd-expurgo: a cada ${EXPURGO_INTERVAL_HOURS}h`)
  console.log('[worker] Workers iniciados com sucesso.')
}

iniciarWorker().catch((err) => {
  console.error('[worker] Erro ao iniciar:', err)
  process.exit(1)
})
