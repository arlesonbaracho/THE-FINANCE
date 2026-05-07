import { describe, it, expect } from 'vitest'
import { parsePlanFeatures, DEFAULT_FEATURES, type PlanFeatures } from '@/lib/plan-features'

describe('parsePlanFeatures', () => {
  it('returns DEFAULT_FEATURES for null', () => {
    expect(parsePlanFeatures(null)).toEqual(DEFAULT_FEATURES)
  })

  it('returns DEFAULT_FEATURES for undefined', () => {
    expect(parsePlanFeatures(undefined)).toEqual(DEFAULT_FEATURES)
  })

  it('returns DEFAULT_FEATURES for a string', () => {
    expect(parsePlanFeatures('invalid')).toEqual(DEFAULT_FEATURES)
  })

  it('parses all features correctly', () => {
    const raw = {
      aiAgent: true,
      advancedReports: true,
      multiUnit: false,
      prioritySupport: true,
      exportReports: false,
    }
    const result = parsePlanFeatures(raw)
    expect(result.aiAgent).toBe(true)
    expect(result.advancedReports).toBe(true)
    expect(result.multiUnit).toBe(false)
    expect(result.prioritySupport).toBe(true)
    expect(result.exportReports).toBe(false)
  })

  it('coerces truthy values', () => {
    const result = parsePlanFeatures({ aiAgent: 1, advancedReports: 'yes' })
    expect(result.aiAgent).toBe(true)
    expect(result.advancedReports).toBe(true)
  })

  it('coerces falsy values', () => {
    const result = parsePlanFeatures({ aiAgent: 0, multiUnit: '' })
    expect(result.aiAgent).toBe(false)
    expect(result.multiUnit).toBe(false)
  })

  it('defaults missing flags to false', () => {
    const result = parsePlanFeatures({ aiAgent: true })
    expect(result.aiAgent).toBe(true)
    expect(result.advancedReports).toBe(false)
    expect(result.multiUnit).toBe(false)
  })

  it('DEFAULT_FEATURES has all flags as false', () => {
    const keys: (keyof PlanFeatures)[] = ['aiAgent', 'advancedReports', 'multiUnit', 'prioritySupport', 'exportReports']
    for (const key of keys) {
      expect(DEFAULT_FEATURES[key]).toBe(false)
    }
  })
})

// ── Plan tier logic ───────────────────────────────────────────────────────────

describe('Plan tier feature sets', () => {
  const basicFeatures = parsePlanFeatures({ aiAgent: false, advancedReports: false, multiUnit: false, prioritySupport: false, exportReports: false })
  const proFeatures   = parsePlanFeatures({ aiAgent: false, advancedReports: true,  multiUnit: false, prioritySupport: false, exportReports: true  })
  const entFeatures   = parsePlanFeatures({ aiAgent: true,  advancedReports: true,  multiUnit: true,  prioritySupport: true,  exportReports: true  })

  it('Basic plan cannot use AI agent or reports', () => {
    expect(basicFeatures.aiAgent).toBe(false)
    expect(basicFeatures.advancedReports).toBe(false)
  })

  it('Pro plan has reports but not AI', () => {
    expect(proFeatures.advancedReports).toBe(true)
    expect(proFeatures.exportReports).toBe(true)
    expect(proFeatures.aiAgent).toBe(false)
  })

  it('Enterprise plan has all features', () => {
    const keys: (keyof PlanFeatures)[] = ['aiAgent', 'advancedReports', 'multiUnit', 'prioritySupport', 'exportReports']
    for (const key of keys) {
      expect(entFeatures[key]).toBe(true)
    }
  })
})
