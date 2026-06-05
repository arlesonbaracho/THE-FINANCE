import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    brand: { create: vi.fn(), findUnique: vi.fn() },
    tenant: { update: vi.fn(), findMany: vi.fn() },
    dashboardSnapshot: { findMany: vi.fn() },
    alert: { count: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import {
  criarBrand,
  adicionarUnidade,
  removerUnidade,
  buscarKpisConsolidados,
} from './brand.service'

const p = prisma as unknown as {
  brand: Record<string, ReturnType<typeof vi.fn>>
  tenant: Record<string, ReturnType<typeof vi.fn>>
  dashboardSnapshot: Record<string, ReturnType<typeof vi.fn>>
  alert: Record<string, ReturnType<typeof vi.fn>>
}

beforeEach(() => { vi.clearAllMocks() })

describe('criarBrand', () => {
  it('cria brand com os dados fornecidos', async () => {
    p.brand.create.mockResolvedValue({ id: 'b-1', nome: 'Rede X', slug: 'rede-x' })
    const result = await criarBrand('u-1', { nome: 'Rede X', slug: 'rede-x', planId: 'p-1' })
    expect(result.slug).toBe('rede-x')
    expect(p.brand.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ adminUserId: 'u-1' }) })
    )
  })
})

describe('adicionarUnidade', () => {
  it('atualiza brandId do tenant', async () => {
    p.tenant.update.mockResolvedValue({})
    await adicionarUnidade('b-1', 't-1')
    expect(p.tenant.update).toHaveBeenCalledWith({
      where: { id: 't-1' },
      data: { brandId: 'b-1' },
    })
  })
})

describe('removerUnidade', () => {
  it('limpa brandId do tenant', async () => {
    p.tenant.update.mockResolvedValue({})
    await removerUnidade('b-1', 't-1')
    expect(p.tenant.update).toHaveBeenCalledWith({
      where: { id: 't-1', brandId: 'b-1' },
      data: { brandId: null, isHeadquarters: false },
    })
  })
})

describe('buscarKpisConsolidados', () => {
  it('retorna zeros quando não há snapshots', async () => {
    p.tenant.findMany.mockResolvedValue([{ id: 't-1', name: 'Unidade A' }])
    p.dashboardSnapshot.findMany.mockResolvedValue([])
    p.alert.count.mockResolvedValue(0)

    const result = await buscarKpisConsolidados('b-1', {
      inicio: new Date('2026-01-01'),
      fim: new Date('2026-01-31'),
    })

    expect(result.totalVendas).toBe(0)
    expect(result.porUnidade).toHaveLength(1)
    expect(result.melhorUnidade).toBeNull()
  })

  it('agrega vendas de múltiplas unidades', async () => {
    p.tenant.findMany.mockResolvedValue([
      { id: 't-1', name: 'Unidade A' },
      { id: 't-2', name: 'Unidade B' },
    ])
    p.dashboardSnapshot.findMany.mockResolvedValue([
      { tenantId: 't-1', totalVendas: 1000, totalPedidos: 50, ticketMedio: 20, cmvPercentual: 35 },
      { tenantId: 't-2', totalVendas: 2000, totalPedidos: 80, ticketMedio: 25, cmvPercentual: 40 },
    ])
    p.alert.count.mockResolvedValue(0)

    const result = await buscarKpisConsolidados('b-1', {
      inicio: new Date('2026-01-01'),
      fim: new Date('2026-01-31'),
    })

    expect(result.totalVendas).toBe(3000)
    expect(result.totalPedidos).toBe(130)
    expect(result.melhorUnidade?.tenantId).toBe('t-2')
  })
})
