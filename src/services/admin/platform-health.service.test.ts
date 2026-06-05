import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    platformHealthLog: { findMany: vi.fn(), create: vi.fn() },
    adminNotification: { create: vi.fn() },
    ifoodWebhookLog: { findMany: vi.fn() },
    aiUsage: { aggregate: vi.fn() },
    $queryRaw: vi.fn(),
  },
}))

vi.mock('@/lib/bullmq', () => ({
  redisConnection: {
    info: vi.fn(),
  },
}))

import { prisma } from '@/lib/prisma'
import { calcularUptime, salvarSnapshot } from './platform-health.service'

const p = prisma as unknown as {
  platformHealthLog: Record<string, ReturnType<typeof vi.fn>>
  adminNotification: Record<string, ReturnType<typeof vi.fn>>
  ifoodWebhookLog: Record<string, ReturnType<typeof vi.fn>>
  aiUsage: Record<string, ReturnType<typeof vi.fn>>
  $queryRaw: ReturnType<typeof vi.fn>
}

beforeEach(() => { vi.clearAllMocks() })

describe('calcularUptime', () => {
  it('retorna 100 quando todos os logs são OK', async () => {
    p.platformHealthLog.findMany.mockResolvedValue([
      { status: 'OK' },
      { status: 'OK' },
      { status: 'OK' },
    ])
    const result = await calcularUptime(24)
    expect(result).toBe(100)
  })

  it('retorna 66.7 quando 2 de 3 são OK', async () => {
    p.platformHealthLog.findMany.mockResolvedValue([
      { status: 'OK' },
      { status: 'OK' },
      { status: 'CRITICO' },
    ])
    const result = await calcularUptime(24)
    expect(result).toBeCloseTo(66.67, 1)
  })

  it('retorna 100 quando não há logs', async () => {
    p.platformHealthLog.findMany.mockResolvedValue([])
    const result = await calcularUptime(24)
    expect(result).toBe(100)
  })
})

describe('salvarSnapshot', () => {
  it('cria logs para métricas de saúde', async () => {
    p.platformHealthLog.create.mockResolvedValue({})
    p.adminNotification.create.mockResolvedValue({})

    await salvarSnapshot({
      uptime24h: 99.5,
      latenciaMedia: 350,
      dbConexoes: 5,
      dbQueriesLentas: 0,
      redisMemoriaPercent: 45,
      redisHitRate: 92,
      aiTokensHoje: 50000,
      aiErroPercent: 0,
      jobsFalhos: 0,
      webhooksIfoodFalhos24h: 0,
    })

    expect(p.platformHealthLog.create).toHaveBeenCalled()
    expect(p.adminNotification.create).not.toHaveBeenCalled()
  })

  it('cria AdminNotification quando há métrica CRITICA (uptime < 50%)', async () => {
    p.platformHealthLog.create.mockResolvedValue({})
    p.adminNotification.create.mockResolvedValue({})

    await salvarSnapshot({
      uptime24h: 40,
      latenciaMedia: 100,
      dbConexoes: 2,
      dbQueriesLentas: 0,
      redisMemoriaPercent: 30,
      redisHitRate: 80,
      aiTokensHoje: 0,
      aiErroPercent: 0,
      jobsFalhos: 0,
      webhooksIfoodFalhos24h: 0,
    })

    expect(p.adminNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ severidade: 'CRITICO' }),
      })
    )
  })
})
