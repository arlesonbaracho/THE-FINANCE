import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    tenant: { findMany: vi.fn() },
    alert: { findMany: vi.fn() },
    purchaseOrder: { create: vi.fn(), findUnique: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { gerarPedidoConsolidado } from './purchase-order.service'

const p = prisma as unknown as {
  tenant: Record<string, ReturnType<typeof vi.fn>>
  alert: Record<string, ReturnType<typeof vi.fn>>
  purchaseOrder: Record<string, ReturnType<typeof vi.fn>>
}

beforeEach(() => { vi.clearAllMocks() })

describe('gerarPedidoConsolidado', () => {
  it('cria PurchaseOrder com itens agrupados por insumo', async () => {
    p.tenant.findMany.mockResolvedValue([{ id: 't-1' }, { id: 't-2' }])
    p.alert.findMany.mockResolvedValue([
      {
        tenantId: 't-1',
        metadata: { ingredientId: 'i-1', quantidadeNecessaria: 10, unit: 'KG' },
      },
      {
        tenantId: 't-2',
        metadata: { ingredientId: 'i-1', quantidadeNecessaria: 5, unit: 'KG' },
      },
      {
        tenantId: 't-1',
        metadata: { ingredientId: 'i-2', quantidadeNecessaria: 3, unit: 'UN' },
      },
    ])
    p.purchaseOrder.create.mockResolvedValue({ id: 'po-1' })

    await gerarPedidoConsolidado('b-1', 'f-1', 'u-admin')

    const createCall = p.purchaseOrder.create.mock.calls[0][0]
    const itens = createCall.data.itens.create
    expect(itens).toHaveLength(2)

    const i1 = itens.find((i: { insumoId: string }) => i.insumoId === 'i-1')
    expect(Number(i1.quantidadeTotal)).toBe(15)
    expect(i1.distribuicaoPorUnidade).toEqual({ 't-1': 10, 't-2': 5 })
  })

  it('cria pedido vazio quando não há alertas ativos', async () => {
    p.tenant.findMany.mockResolvedValue([{ id: 't-1' }])
    p.alert.findMany.mockResolvedValue([])
    p.purchaseOrder.create.mockResolvedValue({ id: 'po-2' })

    await gerarPedidoConsolidado('b-1', 'f-1', 'u-admin')

    const createCall = p.purchaseOrder.create.mock.calls[0][0]
    expect(createCall.data.itens.create).toHaveLength(0)
  })
})
