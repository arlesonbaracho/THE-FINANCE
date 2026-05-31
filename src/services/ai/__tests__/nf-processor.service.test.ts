import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    ingredient: { findMany: vi.fn() },
    nfProcessada: { update: vi.fn() },
  },
}))

vi.mock('@/lib/cloudinary', () => ({ uploadBuffer: vi.fn() }))
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(function () {
    return {
      getGenerativeModel: vi.fn().mockReturnValue({
        generateContent: vi.fn(),
        startChat: vi.fn(),
      }),
    }
  }),
}))

import { prisma } from '@/lib/prisma'
import { enriquecerItens } from '../nf-processor.service'

const p = prisma as unknown as { ingredient: Record<string, ReturnType<typeof vi.fn>> }

beforeEach(() => { vi.clearAllMocks() })

describe('enriquecerItens', () => {
  it('matches ingredient with high confidence on exact name', async () => {
    p.ingredient.findMany.mockResolvedValue([
      { id: 'ing-1', name: 'Farinha de Trigo' },
      { id: 'ing-2', name: 'Açúcar Cristal' },
    ])

    const result = await enriquecerItens('t-1', [
      { descricao: 'Farinha de Trigo', quantidade: 5, unidade: 'KG', custoUnitario: 4.5, custoTotal: 22.5 },
    ])

    expect(result[0].insumoId).toBe('ing-1')
    expect(result[0].scoreConfianca).toBeGreaterThan(70)
  })

  it('returns null insumoId and 0 confidence when no ingredients exist', async () => {
    p.ingredient.findMany.mockResolvedValue([])

    const result = await enriquecerItens('t-1', [
      { descricao: 'Pimenta do Reino', quantidade: 1, unidade: 'UN', custoUnitario: 10, custoTotal: 10 },
    ])

    expect(result[0].insumoId).toBeNull()
    expect(result[0].scoreConfianca).toBe(0)
  })

  it('returns low confidence score for dissimilar names', async () => {
    p.ingredient.findMany.mockResolvedValue([
      { id: 'ing-1', name: 'Manteiga sem sal' },
    ])

    const result = await enriquecerItens('t-1', [
      { descricao: 'Carne bovina contrafilé', quantidade: 2, unidade: 'KG', custoUnitario: 50, custoTotal: 100 },
    ])

    expect(result[0].scoreConfianca).toBeLessThan(40)
  })

  it('preserves original item fields in enriched result', async () => {
    p.ingredient.findMany.mockResolvedValue([{ id: 'ing-1', name: 'Sal' }])

    const result = await enriquecerItens('t-1', [
      { descricao: 'Sal refinado', quantidade: 3, unidade: 'KG', custoUnitario: 2, custoTotal: 6 },
    ])

    expect(result[0].quantidade).toBe(3)
    expect(result[0].custoTotal).toBe(6)
  })
})
