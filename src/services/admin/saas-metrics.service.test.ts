import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    tenantSubscription: { findMany: vi.fn(), aggregate: vi.fn(), count: vi.fn() },
    saasMetricsSnapshot: { findMany: vi.fn(), upsert: vi.fn() },
    planHistory: { findMany: vi.fn() },
    tenant: { count: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { calcularMRR, calcularChurn, projecaoReceita } from './saas-metrics.service'

const p = prisma as unknown as {
  tenantSubscription: Record<string, ReturnType<typeof vi.fn>>
  saasMetricsSnapshot: Record<string, ReturnType<typeof vi.fn>>
  planHistory: Record<string, ReturnType<typeof vi.fn>>
  tenant: Record<string, ReturnType<typeof vi.fn>>
}

beforeEach(() => { vi.clearAllMocks() })

describe('calcularMRR', () => {
  it('soma contractedPrice de subscriptions ATIVO', async () => {
    p.tenantSubscription.findMany.mockResolvedValue([
      { planId: 'p-1', contractedPrice: 299 },
      { planId: 'p-1', contractedPrice: 299 },
      { planId: 'p-2', contractedPrice: 499 },
    ])

    const result = await calcularMRR()

    expect(result.total).toBe(1097)
    expect(result.porPlano['p-1']).toBe(598)
    expect(result.porPlano['p-2']).toBe(499)
  })

  it('retorna zero quando não há subscriptions ativas', async () => {
    p.tenantSubscription.findMany.mockResolvedValue([])
    const result = await calcularMRR()
    expect(result.total).toBe(0)
  })
})

describe('calcularChurn', () => {
  it('divide cancelamentos pelo total ativo no início do mês', async () => {
    p.tenantSubscription.count
      .mockResolvedValueOnce(2)   // cancelados no mês
      .mockResolvedValueOnce(10)  // ativos no início

    const result = await calcularChurn(1, 2026)
    expect(result.churnRate).toBeCloseTo(20, 1)
    expect(result.cancelamentos).toBe(2)
  })

  it('retorna 0 quando não há ativos no início do mês', async () => {
    p.tenantSubscription.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)

    const result = await calcularChurn(1, 2026)
    expect(result.churnRate).toBe(0)
  })
})

describe('projecaoReceita', () => {
  it('projeta meses com base na taxa de crescimento média', async () => {
    p.saasMetricsSnapshot.findMany.mockResolvedValue([
      { data: new Date('2026-01-01'), mrr: 1000 },
      { data: new Date('2026-02-01'), mrr: 1100 },
      { data: new Date('2026-03-01'), mrr: 1210 },
    ])

    const result = await projecaoReceita(3)

    expect(result).toHaveLength(3)
    // Taxa ~10% → mês 4 ≈ 1331
    expect(Number(result[0].mrr)).toBeCloseTo(1331, -1)
  })

  it('retorna projeção com MRR atual quando não há snapshots suficientes', async () => {
    p.saasMetricsSnapshot.findMany.mockResolvedValue([])
    p.tenantSubscription.findMany.mockResolvedValue([{ planId: 'p-1', contractedPrice: 500 }])

    const result = await projecaoReceita(3)
    expect(result).toHaveLength(3)
    expect(result[0].mrr).toBe(500)
  })
})
