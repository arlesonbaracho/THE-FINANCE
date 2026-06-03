import IORedis from 'ioredis'
import type { ConnectionOptions } from 'bullmq'

export const redisConnectionOptions: ConnectionOptions = {
  host: (() => {
    try {
      return new URL(process.env.REDIS_URL ?? 'redis://localhost:6379').hostname
    } catch {
      return 'localhost'
    }
  })(),
  port: (() => {
    try {
      return parseInt(new URL(process.env.REDIS_URL ?? 'redis://localhost:6379').port || '6379', 10)
    } catch {
      return 6379
    }
  })(),
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
}

export const redisConnection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
  retryStrategy: (times) => Math.min(times * 500, 10000),
})

// Prevent unhandled error events from crashing the process
// ECONNREFUSED = Redis não está rodando
// EPIPE = pipe quebrado durante reconexão (ioredis reconecta automaticamente)
const IGNORED_REDIS_ERRORS = new Set(['ECONNREFUSED', 'EPIPE', 'ECONNRESET'])
redisConnection.on('error', (err) => {
  if (!IGNORED_REDIS_ERRORS.has((err as NodeJS.ErrnoException).code ?? '')) {
    console.error('[redis]', err.message)
  }
})
