/**
 * In-memory rate limiter (per-IP, sliding window).
 * Suitable for single-instance deployments. For multi-instance, replace with Redis.
 */

interface Window {
  count: number
  resetAt: number
}

const store = new Map<string, Window>()

/** Cleans up expired entries every 5 minutes to prevent memory leaks */
setInterval(() => {
  const now = Date.now()
  store.forEach((win, key) => {
    if (now > win.resetAt) store.delete(key)
  })
}, 5 * 60 * 1000)

interface RateLimitOptions {
  /** Maximum requests allowed within the window */
  limit: number
  /** Window duration in milliseconds */
  windowMs: number
}

interface RateLimitResult {
  success: boolean
  /** Remaining requests this window */
  remaining: number
  /** Seconds until the window resets */
  retryAfter: number
}

export function rateLimit(
  key: string,
  { limit, windowMs }: RateLimitOptions
): RateLimitResult {
  const now = Date.now()
  const existing = store.get(key)

  if (!existing || now > existing.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { success: true, remaining: limit - 1, retryAfter: 0 }
  }

  existing.count += 1

  if (existing.count > limit) {
    const retryAfter = Math.ceil((existing.resetAt - now) / 1000)
    return { success: false, remaining: 0, retryAfter }
  }

  return {
    success: true,
    remaining: limit - existing.count,
    retryAfter: 0,
  }
}

/** Extracts a best-effort client IP from request headers */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}
