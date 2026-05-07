import { describe, it, expect, beforeEach } from 'vitest'

// Re-import module fresh for each test to reset the store
let rateLimit: typeof import('@/lib/rate-limit').rateLimit

beforeEach(async () => {
  // Clear module cache so the Map store is reset between test groups
  const mod = await import('@/lib/rate-limit')
  rateLimit = mod.rateLimit
})

describe('rateLimit', () => {
  it('allows first request', () => {
    const result = rateLimit(`test-key-${Date.now()}`, { limit: 3, windowMs: 10_000 })
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(2)
  })

  it('tracks remaining count', () => {
    const key = `track-${Date.now()}-${Math.random()}`
    const opts = { limit: 3, windowMs: 10_000 }
    rateLimit(key, opts)
    rateLimit(key, opts)
    const third = rateLimit(key, opts)
    expect(third.success).toBe(true)
    expect(third.remaining).toBe(0)
  })

  it('blocks after limit is reached', () => {
    const key = `block-${Date.now()}-${Math.random()}`
    const opts = { limit: 2, windowMs: 10_000 }
    rateLimit(key, opts)
    rateLimit(key, opts)
    const blocked = rateLimit(key, opts)
    expect(blocked.success).toBe(false)
    expect(blocked.remaining).toBe(0)
    expect(blocked.retryAfter).toBeGreaterThan(0)
  })

  it('different keys are independent', () => {
    const ts = Date.now()
    const opts = { limit: 1, windowMs: 10_000 }
    rateLimit(`key-a-${ts}`, opts)
    const result = rateLimit(`key-b-${ts}`, opts)
    expect(result.success).toBe(true)
  })

  it('resets after window expires', async () => {
    const key = `reset-${Date.now()}-${Math.random()}`
    const opts = { limit: 1, windowMs: 50 } // 50ms window
    rateLimit(key, opts)
    rateLimit(key, opts) // blocked

    await new Promise((r) => setTimeout(r, 60))

    const after = rateLimit(key, opts)
    expect(after.success).toBe(true)
  })
})
