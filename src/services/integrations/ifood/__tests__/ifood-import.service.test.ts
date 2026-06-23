import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    iFoodItemMap: { findMany: vi.fn(), upsert: vi.fn() },
    product: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
    category: { findUnique: vi.fn(), create: vi.fn() },
  },
}))

import { prepararImportacaoCardapio, confirmarImportacaoCardapio } from '../ifood-import.service'
import { prisma } from '@/lib/prisma'

const mp = prisma as any
const catalogo = [
  { id: 'i1', name: 'X-Burger', price: 20, available: true, categoryName: 'Lanches' },
  { id: 'i2', name: 'Coca 350ml', price: 6, available: true, categoryName: 'Bebidas' },
]

describe('prepararImportacaoCardapio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mp.iFoodItemMap.findMany.mockResolvedValue([{ ifoodItemId: 'i1', produtoId: 'p1' }])
    mp.product.findMany.mockResolvedValue([{ id: 'p1', name: 'X-Burger' }, { id: 'p9', name: 'Suco' }])
  })
  it('classifica mapeado / casar / criar', async () => {
    const r = await prepararImportacaoCardapio('t1', async () => catalogo as any)
    const i1 = r.find((x) => x.ifoodItemId === 'i1')!
    const i2 = r.find((x) => x.ifoodItemId === 'i2')!
    expect(i1.sugestao).toBe('mapeado')
    expect(i2.sugestao).toBe('criar')
  })
})

describe('confirmarImportacaoCardapio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mp.category.findUnique.mockResolvedValue(null)
    mp.category.create.mockResolvedValue({ id: 'cat1' })
    mp.product.create.mockResolvedValue({ id: 'pnew' })
    mp.iFoodItemMap.upsert.mockResolvedValue({})
  })
  it('cria categoria + produto + map para acao=criar', async () => {
    const r = await confirmarImportacaoCardapio('t1', [
      { ifoodItemId: 'i2', ifoodItemNome: 'Coca 350ml', preco: 6, categoriaNome: 'Bebidas', acao: 'criar' },
    ])
    expect(mp.category.create).toHaveBeenCalled()
    expect(mp.product.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: 'Coca 350ml', salePrice: 6, tenantId: 't1', categoryId: 'cat1' }),
    }))
    expect(mp.iFoodItemMap.upsert).toHaveBeenCalled()
    expect(r.criados).toBe(1)
  })
  it('apenas grava map para acao=casar', async () => {
    mp.product.findFirst.mockResolvedValue({ id: 'pX' })
    const r = await confirmarImportacaoCardapio('t1', [
      { ifoodItemId: 'i3', ifoodItemNome: 'Batata', preco: 12, categoriaNome: null, acao: 'casar', produtoId: 'pX' },
    ])
    expect(mp.product.create).not.toHaveBeenCalled()
    expect(mp.iFoodItemMap.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ produtoId: 'pX', ifoodItemId: 'i3' }),
    }))
    expect(r.mapeados).toBe(1)
  })
  it('casar rejeita produtoId que não é do tenant', async () => {
    mp.product.findFirst.mockResolvedValue(null) // produto não pertence ao tenant
    await expect(
      confirmarImportacaoCardapio('t1', [{ acao: 'casar', ifoodItemId: 'if1', ifoodItemNome: 'X', preco: 1, produtoId: 'P-de-outro-tenant' }] as any)
    ).rejects.toThrow(/não pertence/i)
    expect(mp.iFoodItemMap.upsert).not.toHaveBeenCalled()
  })
  it('casar aceita produtoId do próprio tenant', async () => {
    mp.product.findFirst.mockResolvedValue({ id: 'P1' })
    mp.iFoodItemMap.upsert.mockResolvedValue({})
    const r = await confirmarImportacaoCardapio('t1', [{ acao: 'casar', ifoodItemId: 'if1', ifoodItemNome: 'X', preco: 1, produtoId: 'P1' }] as any)
    expect(mp.product.findFirst).toHaveBeenCalledWith({ where: { id: 'P1', tenantId: 't1' }, select: { id: true } })
    expect(mp.iFoodItemMap.upsert).toHaveBeenCalled()
    expect(r.mapeados).toBe(1)
  })
})
