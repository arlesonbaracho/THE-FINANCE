import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    tenantSubscription: {
      findUnique: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import { checkMultiUnitFeature } from '../check-multi-unit'

const p = prisma as unknown as {
  tenantSubscription: { findUnique: ReturnType<typeof vi.fn> }
}

beforeEach(() => { vi.clearAllMocks() })

describe('checkMultiUnitFeature', () => {
  it('lança 403 quando tenant não tem assinatura', async () => {
    p.tenantSubscription.findUnique.mockResolvedValue(null)
    await expect(checkMultiUnitFeature('t-1')).rejects.toMatchObject({ status: 403 })
  })

  it('lança 403 quando plano não tem multiUnit', async () => {
    p.tenantSubscription.findUnique.mockResolvedValue({
      plan: { features: { multiUnit: false, aiAgent: false, advancedReports: false, prioritySupport: false, exportReports: false } },
    })
    await expect(checkMultiUnitFeature('t-1')).rejects.toMatchObject({ status: 403 })
  })

  it('resolve sem erro quando multiUnit está habilitado', async () => {
    p.tenantSubscription.findUnique.mockResolvedValue({
      plan: { features: { multiUnit: true, aiAgent: false, advancedReports: false, prioritySupport: false, exportReports: false } },
    })
    await expect(checkMultiUnitFeature('t-1')).resolves.toBeUndefined()
  })
})
