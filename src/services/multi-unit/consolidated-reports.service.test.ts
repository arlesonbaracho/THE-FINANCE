import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    tenant: { findMany: vi.fn() },
    dashboardSnapshot: { findMany: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { benchmarkUnidades } from './consolidated-reports.service'

const p = prisma as unknown as {
  tenant: Record<string, ReturnType<typeof vi.fn>>
  dashboardSnapshot: Record<string, ReturnType<typeof vi.fn>>
}

beforeEach(() => { vi.clearAllMocks() })

describe('benchmarkUnidades', () => {
  it('retorna array vazio quando não há unidades', async () => {
    p.tenant.findMany.mockResolvedValue([])
    p.dashboardSnapshot.findMany.mockResolvedValue([])

    const result = await benchmarkUnidades('b-1', {
      inicio: new Date('2026-01-01'),
      fim: new Date('2026-01-31'),
    })

    expect(result.unidades).toHaveLength(0)
    expect(result.mediaCmv).toBe(0)
  })

  it('marca como abaixoDaMedia quando unidade < 80% da média de ticket', async () => {
    p.tenant.findMany.mockResolvedValue([
      { id: 't-1', name: 'A' },
      { id: 't-2', name: 'B' },
    ])
    p.dashboardSnapshot.findMany.mockResolvedValue([
      { tenantId: 't-1', totalVendas: 5000, totalPedidos: 100, ticketMedio: 50, cmvPercentual: 30, cmvTotal: 1500 },
      { tenantId: 't-2', totalVendas: 100,  totalPedidos: 20,  ticketMedio: 5,  cmvPercentual: 40, cmvTotal: 40  },
    ])
    // t-1 ticket=50, t-2 ticket=5 → média=27.5, 80%=22 → t-2 abaixo

    const result = await benchmarkUnidades('b-1', {
      inicio: new Date('2026-01-01'),
      fim: new Date('2026-01-31'),
    })

    const t2 = result.unidades.find((u) => u.tenantId === 't-2')!
    expect(t2.abaixoDaMedia).toBe(true)
  })

  it('identifica líder por CMV% (menor CMV = líder)', async () => {
    p.tenant.findMany.mockResolvedValue([
      { id: 't-1', name: 'A' },
      { id: 't-2', name: 'B' },
    ])
    p.dashboardSnapshot.findMany.mockResolvedValue([
      { tenantId: 't-1', totalVendas: 1000, totalPedidos: 50, ticketMedio: 20, cmvPercentual: 25, cmvTotal: 250 },
      { tenantId: 't-2', totalVendas: 1000, totalPedidos: 50, ticketMedio: 20, cmvPercentual: 40, cmvTotal: 400 },
    ])

    const result = await benchmarkUnidades('b-1', {
      inicio: new Date('2026-01-01'),
      fim: new Date('2026-01-31'),
    })

    const lider = result.unidades.find((u) => u.liderCmv)
    expect(lider?.tenantId).toBe('t-1')
  })
})
