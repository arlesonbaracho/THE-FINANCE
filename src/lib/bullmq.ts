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
})
