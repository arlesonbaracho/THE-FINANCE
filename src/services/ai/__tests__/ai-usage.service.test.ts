import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    aiUsage: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    aiUsageHistory: {
      createMany: vi.fn(),
    },
    tenantSubscription: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

import { prisma } from '@/lib/prisma'
import { verificarLimite, incrementarUso, resetarUsoMensal } from '../ai-usage.service'

const p = prisma as {
  aiUsage: Record<string, ReturnType<typeof vi.fn>>
  aiUsageHistory: Record<string, ReturnType<typeof vi.fn>>
  tenantSubscription: Record<string, ReturnType<typeof vi.fn>>
  $transaction: ReturnType<typeof vi.fn>
}

beforeEach(() => { vi.clearAllMocks() })

describe('verificarLimite', () => {
  it('returns permitido:true and 0% when no usage record exists', async () => {
    p.aiUsage.findUnique.mockResolvedValue(null)
    expect(await verificarLimite('t-1')).toEqual({ permitido: true, percentual: 0 })
  })

  it('returns permitido:true for enterprise when limiteTokens is 0', async () => {
    p.aiUsage.findUnique.mockResolvedValue({ limiteTokens: 0, tokensInput: 999999, tokensOutput: 0 })
    expect(await verificarLimite('t-1')).toEqual({ permitido: true, percentual: 0 })
  })

  it('returns permitido:false when total tokens exceed limit', async () => {
    p.aiUsage.findUnique.mockResolvedValue({ limiteTokens: 100, tokensInput: 60, tokensOutput: 50 })
    const result = await verificarLimite('t-1')
    expect(result.permitido).toBe(false)
    expect(result.percentual).toBe(100)
  })

  it('calculates 80% correctly', async () => {
    p.aiUsage.findUnique.mockResolvedValue({ limiteTokens: 100, tokensInput: 50, tokensOutput: 30 })
    const result = await verificarLimite('t-1')
    expect(result.permitido).toBe(true)
    expect(result.percentual).toBe(80)
  })
})

describe('incrementarUso', () => {
  it('creates new record when none exists, using default PRO limit', async () => {
    p.aiUsage.findUnique.mockResolvedValue(null)
    p.tenantSubscription.findUnique.mockResolvedValue(null)
    p.aiUsage.create.mockResolvedValue({})

    await incrementarUso('t-1', 1000, 500)

    expect(p.aiUsage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tokensInput: 1000,
          tokensOutput: 500,
          limiteTokens: 500000,
        }),
      })
    )
  })

  it('accumulates tokens on existing record', async () => {
    p.aiUsage.findUnique.mockResolvedValue({ tokensInput: 200, tokensOutput: 100 })
    p.aiUsage.update.mockResolvedValue({})

    await incrementarUso('t-1', 100, 50)

    expect(p.aiUsage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tokensInput: 300, tokensOutput: 150 }),
      })
    )
  })
})

describe('resetarUsoMensal', () => {
  it('does nothing when there are no usage records', async () => {
    p.aiUsage.findMany.mockResolvedValue([])
    await resetarUsoMensal()
    expect(p.$transaction).not.toHaveBeenCalled()
  })

  it('snapshots history and zeros all records', async () => {
    p.aiUsage.findMany.mockResolvedValue([
      { tenantId: 't-1', mes: 5, ano: 2026, tokensInput: 1000, tokensOutput: 500, custoEstimado: 0.01 },
    ])
    p.$transaction.mockResolvedValue([])

    await resetarUsoMensal()

    expect(p.$transaction).toHaveBeenCalledTimes(1)
  })
})
