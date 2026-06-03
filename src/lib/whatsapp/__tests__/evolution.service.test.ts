import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/bullmq', () => ({
  redisConnection: {
    pipeline: vi.fn(),
  },
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { enviarMensagem, verificarConexao } from '../evolution.service'
import { redisConnection } from '@/lib/bullmq'

const redis = redisConnection as unknown as { pipeline: ReturnType<typeof vi.fn> }

function mockPipeline(count: number) {
  const pipeline = {
    incr: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([[null, count], [null, 1]]),
  }
  redis.pipeline.mockReturnValue(pipeline)
  return pipeline
}

describe('enviarMensagem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true on 200', async () => {
    mockPipeline(1)
    mockFetch.mockResolvedValue({ status: 200 })
    expect(await enviarMensagem('+5511999', 'Oi', 'tenant-1')).toBe(true)
  })

  it('returns false on non-2xx', async () => {
    mockPipeline(1)
    mockFetch.mockResolvedValue({ status: 500 })
    expect(await enviarMensagem('+5511999', 'Oi', 'tenant-1')).toBe(false)
  })

  it('returns false without throwing on network error', async () => {
    mockPipeline(1)
    mockFetch.mockRejectedValue(new Error('timeout'))
    expect(await enviarMensagem('+5511999', 'Oi', 'tenant-1')).toBe(false)
  })

  it('blocks fetch when rate limit exceeded', async () => {
    mockPipeline(11) // > 10 limit
    expect(await enviarMensagem('+5511999', 'Oi', 'tenant-rate')).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns false without throwing on Redis error', async () => {
    redis.pipeline.mockImplementation(() => { throw new Error('redis down') })
    expect(await enviarMensagem('+5511999', 'Oi', 'tenant-err')).toBe(false)
  })
})

describe('verificarConexao', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns true when state is open', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ instance: { state: 'open' } }) })
    expect(await verificarConexao()).toBe(true)
  })

  it('returns false when state is not open', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ instance: { state: 'close' } }) })
    expect(await verificarConexao()).toBe(false)
  })

  it('returns false on fetch error', async () => {
    mockFetch.mockRejectedValue(new Error('unreachable'))
    expect(await verificarConexao()).toBe(false)
  })

  it('returns false when fetch returns non-ok', async () => {
    mockFetch.mockResolvedValue({ ok: false })
    expect(await verificarConexao()).toBe(false)
  })
})
