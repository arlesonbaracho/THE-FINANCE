import { Queue } from 'bullmq'
import { redisConnectionOptions } from './bullmq'

export const nfQueue = new Queue('nf-processing', {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'fixed', delay: 5000 },
  },
})
