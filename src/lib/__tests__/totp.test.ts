import { describe, it, expect } from 'vitest'
import { generateTotpSecret, verifyTotpToken, generateTotpToken } from '@/lib/totp'

describe('generateTotpSecret', () => {
  it('generates a non-empty string', () => {
    const secret = generateTotpSecret()
    expect(typeof secret).toBe('string')
    expect(secret.length).toBeGreaterThan(10)
  })

  it('generates unique secrets each call', () => {
    expect(generateTotpSecret()).not.toBe(generateTotpSecret())
  })
})

describe('verifyTotpToken', () => {
  it('accepts a valid token for the given secret', () => {
    const secret = generateTotpSecret()
    const validToken = generateTotpToken(secret)
    expect(verifyTotpToken(validToken, secret)).toBe(true)
  })

  it('rejects a token with the wrong secret', () => {
    const secret1 = generateTotpSecret()
    const secret2 = generateTotpSecret()
    const token = generateTotpToken(secret1)
    expect(verifyTotpToken(token, secret2)).toBe(false)
  })

  it('rejects an obviously wrong token', () => {
    const secret = generateTotpSecret()
    expect(verifyTotpToken('000000', secret)).toBe(false)
  })

  it('rejects malformed token gracefully — no throw', () => {
    const secret = generateTotpSecret()
    expect(() => verifyTotpToken('not-a-number', secret)).not.toThrow()
    expect(verifyTotpToken('not-a-number', secret)).toBe(false)
  })
})
