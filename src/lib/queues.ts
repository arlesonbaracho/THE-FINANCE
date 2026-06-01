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
