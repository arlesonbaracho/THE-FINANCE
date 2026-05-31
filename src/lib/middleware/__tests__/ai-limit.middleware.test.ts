import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    alert: { findFirst: vi.fn(), create: vi.fn() },
  },
}))

vi.mock('@/services/ai/ai-usage.service', () => ({
  verificarLimite: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { verificarLimite } from '@/services/ai/ai-usage.service'
import { checkAiLimit } from '../ai-limit.middleware'

const p = prisma as unknown as { alert: Record<string, ReturnType<typeof vi.fn>> }
const mockVerificar = verificarLimite as ReturnType<typeof vi.fn>

beforeEach(() => { vi.clearAllMocks() })

describe('checkAiLimit', () => {
  it('passes through permitido:true when under 80%', async () => {
    mockVerificar.mockResolvedValue({ permitido: true, percentual: 50 })
    const result = await checkAiLimit('t-1')
    expect(result).toEqual({ permitido: true, percentual: 50 })
    expect(p.alert.create).not.toHaveBeenCalled()
  })

  it('creates SISTEMA alert when at 80% and no recent alert exists', async () => {
    mockVerificar.mockResolvedValue({ permitido: true, percentual: 82 })
    p.alert.findFirst.mockResolvedValue(null)
    p.alert.create.mockResolvedValue({})

    await checkAiLimit('t-1')

    expect(p.alert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tipo: 'SISTEMA', severidade: 'ALTA' }),
      })
    )
  })

  it('does not create duplicate alert when one exists within 24h', async () => {
    mockVerificar.mockResolvedValue({ permitido: true, percentual: 85 })
    p.alert.findFirst.mockResolvedValue({ id: 'existing-alert' })

    await checkAiLimit('t-1')

    expect(p.alert.create).not.toHaveBeenCalled()
  })

  it('returns permitido:false when limit exceeded', async () => {
    mockVerificar.mockResolvedValue({ permitido: false, percentual: 100 })
    p.alert.findFirst.mockResolvedValue(null)
    p.alert.create.mockResolvedValue({})

    const result = await checkAiLimit('t-1')

    expect(result.permitido).toBe(false)
  })
})
