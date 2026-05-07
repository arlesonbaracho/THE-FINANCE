import { describe, it, expect } from 'vitest'

// ── Plan change logic ─────────────────────────────────────────────────────────

type BillingCycle = 'MONTHLY' | 'ANNUAL'

function getEffectivePrice(plan: { monthlyPrice: number; annualPrice: number }, cycle: BillingCycle): number {
  return cycle === 'ANNUAL' ? plan.annualPrice / 12 : plan.monthlyPrice
}

function determinePlanAction(
  currentPrice: number,
  newPrice: number
): 'UPGRADE' | 'DOWNGRADE' | 'SAME' {
  if (newPrice > currentPrice) return 'UPGRADE'
  if (newPrice < currentPrice) return 'DOWNGRADE'
  return 'SAME'
}

function calcAnnualDiscount(monthlyPrice: number, annualPrice: number): number {
  const effectiveMonthly = annualPrice / 12
  return ((monthlyPrice - effectiveMonthly) / monthlyPrice) * 100
}

describe('getEffectivePrice', () => {
  const plan = { monthlyPrice: 100, annualPrice: 960 }

  it('returns monthly price for MONTHLY cycle', () => {
    expect(getEffectivePrice(plan, 'MONTHLY')).toBe(100)
  })

  it('returns divided annual price for ANNUAL cycle', () => {
    expect(getEffectivePrice(plan, 'ANNUAL')).toBe(80) // 960/12
  })

  it('annual is always less than or equal to monthly', () => {
    expect(getEffectivePrice(plan, 'ANNUAL')).toBeLessThanOrEqual(getEffectivePrice(plan, 'MONTHLY'))
  })
})

describe('determinePlanAction', () => {
  it('UPGRADE when new price is higher', () => {
    expect(determinePlanAction(50, 100)).toBe('UPGRADE')
  })

  it('DOWNGRADE when new price is lower', () => {
    expect(determinePlanAction(100, 50)).toBe('DOWNGRADE')
  })

  it('SAME when price is equal', () => {
    expect(determinePlanAction(100, 100)).toBe('SAME')
  })

  it('handles decimal prices', () => {
    expect(determinePlanAction(99.99, 149.99)).toBe('UPGRADE')
  })
})

describe('calcAnnualDiscount', () => {
  it('calculates ~20% discount for standard pricing', () => {
    const discount = calcAnnualDiscount(100, 960) // 100/mo vs 80/mo effective
    expect(discount).toBeCloseTo(20, 5)
  })

  it('zero discount when annual equals 12x monthly', () => {
    expect(calcAnnualDiscount(100, 1200)).toBeCloseTo(0, 5)
  })

  it('larger discount for more aggressive annual pricing', () => {
    const discount = calcAnnualDiscount(100, 720) // 60/mo effective = 40% off
    expect(discount).toBeCloseTo(40, 5)
  })
})

// ── Cancellation scheduling ───────────────────────────────────────────────────

function scheduleCancellation(requestedAt: Date, retentionDays: number = 30): Date {
  const scheduled = new Date(requestedAt.getTime())
  scheduled.setDate(scheduled.getDate() + retentionDays)
  return scheduled
}

function isCancellationRevocable(
  requestedAt: Date,
  scheduledAt: Date,
  now: Date = new Date()
): boolean {
  return now < scheduledAt
}

describe('scheduleCancellation', () => {
  it('schedules 30 days from request', () => {
    const requestedAt = new Date('2026-05-03T00:00:00Z')
    const scheduled = scheduleCancellation(requestedAt, 30)
    const diffDays = (scheduled.getTime() - requestedAt.getTime()) / (1000 * 60 * 60 * 24)
    expect(diffDays).toBe(30)
  })

  it('respects custom retention period', () => {
    const requestedAt = new Date('2026-05-03T00:00:00Z')
    const scheduled = scheduleCancellation(requestedAt, 7)
    const diff = (scheduled.getTime() - requestedAt.getTime()) / (1000 * 60 * 60 * 24)
    expect(diff).toBe(7)
  })

  it('returns a future date', () => {
    const now = new Date()
    expect(scheduleCancellation(now)).toBeInstanceOf(Date)
    expect(scheduleCancellation(now).getTime()).toBeGreaterThan(now.getTime())
  })
})

describe('isCancellationRevocable', () => {
  it('is revocable before scheduled date', () => {
    const requestedAt = new Date('2026-05-03')
    const scheduledAt = new Date('2026-06-02')
    const now = new Date('2026-05-10')
    expect(isCancellationRevocable(requestedAt, scheduledAt, now)).toBe(true)
  })

  it('is not revocable after scheduled date', () => {
    const requestedAt = new Date('2026-05-03')
    const scheduledAt = new Date('2026-06-02')
    const now = new Date('2026-06-05') // after scheduled
    expect(isCancellationRevocable(requestedAt, scheduledAt, now)).toBe(false)
  })

  it('is not revocable on the scheduled date itself', () => {
    const scheduledAt = new Date('2026-06-02T12:00:00Z')
    const now = new Date('2026-06-02T13:00:00Z')
    expect(isCancellationRevocable(now, scheduledAt, now)).toBe(false)
  })
})

// ── Cancellation confirmation validation ──────────────────────────────────────

function validateCancelConfirmation(input: string): boolean {
  return input === 'CANCELAR'
}

function validateDowngradeConfirmation(input: string): boolean {
  return input === 'CONFIRMAR'
}

describe('validateCancelConfirmation', () => {
  it('accepts exact string CANCELAR', () => {
    expect(validateCancelConfirmation('CANCELAR')).toBe(true)
  })

  it('rejects lowercase', () => {
    expect(validateCancelConfirmation('cancelar')).toBe(false)
  })

  it('rejects partial match', () => {
    expect(validateCancelConfirmation('CANCEL')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(validateCancelConfirmation('')).toBe(false)
  })

  it('rejects string with extra spaces', () => {
    expect(validateCancelConfirmation(' CANCELAR')).toBe(false)
  })
})

describe('validateDowngradeConfirmation', () => {
  it('accepts exact string CONFIRMAR', () => {
    expect(validateDowngradeConfirmation('CONFIRMAR')).toBe(true)
  })

  it('rejects lowercase', () => {
    expect(validateDowngradeConfirmation('confirmar')).toBe(false)
  })
})

// ── Subscription status transitions ──────────────────────────────────────────

type SubStatus = 'TRIAL' | 'ACTIVE' | 'OVERDUE' | 'CANCELLED' | 'SUSPENDED'

function canChangePlan(status: SubStatus): boolean {
  return status === 'TRIAL' || status === 'ACTIVE'
}

function canCancel(status: SubStatus): boolean {
  return status !== 'CANCELLED'
}

function isAccessBlocked(status: SubStatus): boolean {
  return status === 'SUSPENDED'
}

describe('canChangePlan', () => {
  it('allows change on TRIAL', () => expect(canChangePlan('TRIAL')).toBe(true))
  it('allows change on ACTIVE', () => expect(canChangePlan('ACTIVE')).toBe(true))
  it('blocks change on OVERDUE', () => expect(canChangePlan('OVERDUE')).toBe(false))
  it('blocks change on CANCELLED', () => expect(canChangePlan('CANCELLED')).toBe(false))
  it('blocks change on SUSPENDED', () => expect(canChangePlan('SUSPENDED')).toBe(false))
})

describe('canCancel', () => {
  it('can cancel ACTIVE subscription', () => expect(canCancel('ACTIVE')).toBe(true))
  it('can cancel TRIAL', () => expect(canCancel('TRIAL')).toBe(true))
  it('cannot cancel already-CANCELLED', () => expect(canCancel('CANCELLED')).toBe(false))
  it('can cancel OVERDUE', () => expect(canCancel('OVERDUE')).toBe(true))
})

describe('isAccessBlocked', () => {
  it('blocks SUSPENDED accounts', () => expect(isAccessBlocked('SUSPENDED')).toBe(true))
  it('does not block ACTIVE', () => expect(isAccessBlocked('ACTIVE')).toBe(false))
  it('does not block OVERDUE (soft block via banner)', () => expect(isAccessBlocked('OVERDUE')).toBe(false))
  it('does not block TRIAL', () => expect(isAccessBlocked('TRIAL')).toBe(false))
})
