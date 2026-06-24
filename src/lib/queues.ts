import { Queue } from 'bullmq'
import { redisConnectionOptions } from './bullmq'

export const nfQueue = new Queue('nf-processing', {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'fixed', delay: 5000 },
  },
})

// Prevent unhandled EPIPE / ECONNREFUSED from crashing the process
// when Redis is not available or drops the connection in dev.
nfQueue.on('error', (err) => {
  const code = (err as NodeJS.ErrnoException).code
  if (code !== 'ECONNREFUSED' && code !== 'EPIPE') {
    console.error('[nfQueue]', err.message)
  }
})

// ── Admin queues (Super Admin Fase 3) ─────────────────────────────────────────

export const platformHealthQueue = new Queue('platform-health', {
  connection: redisConnectionOptions,
  defaultJobOptions: { attempts: 2, backoff: { type: 'fixed', delay: 3000 } },
})

export const saasMetricsQueue = new Queue('saas-metrics-snapshot', {
  connection: redisConnectionOptions,
  defaultJobOptions: { attempts: 2, backoff: { type: 'fixed', delay: 5000 } },
})

export const nfCaptureQueue = new Queue('nf-capture', {
  connection: redisConnectionOptions,
  defaultJobOptions: { attempts: 3, backoff: { type: 'fixed', delay: 5000 } },
})

export const nfceRetryQueue = new Queue('nfce-retry', {
  connection: redisConnectionOptions,
  defaultJobOptions: { attempts: 3, backoff: { type: 'fixed', delay: 5000 } },
})

export const expurgoQueue = new Queue('lgpd-expurgo', {
  connection: redisConnectionOptions,
  defaultJobOptions: { attempts: 2, backoff: { type: 'fixed', delay: 5000 } },
})

for (const q of [platformHealthQueue, saasMetricsQueue, nfCaptureQueue, nfceRetryQueue, expurgoQueue]) {
  q.on('error', (err) => {
    const code = (err as NodeJS.ErrnoException).code
    if (code !== 'ECONNREFUSED' && code !== 'EPIPE') {
      console.error(`[${q.name}]`, err.message)
    }
  })
}
