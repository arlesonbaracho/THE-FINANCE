import { describe, it, expect } from 'vitest'
import { generateVerificationCode } from '@/lib/verification-code'

describe('generateVerificationCode', () => {
  it('returns a string of exactly 6 characters', () => {
    const code = generateVerificationCode()
    expect(typeof code).toBe('string')
    expect(code).toHaveLength(6)
  })

  it('contains only digits', () => {
    const code = generateVerificationCode()
    expect(/^\d{6}$/.test(code)).toBe(true)
  })

  it('is always at least 100000', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateVerificationCode()
      expect(parseInt(code, 10)).toBeGreaterThanOrEqual(100000)
    }
  })

  it('is always at most 999999', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateVerificationCode()
      expect(parseInt(code, 10)).toBeLessThanOrEqual(999999)
    }
  })

  it('generates different codes across calls', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateVerificationCode()))
    expect(codes.size).toBeGreaterThan(1)
  })
})
