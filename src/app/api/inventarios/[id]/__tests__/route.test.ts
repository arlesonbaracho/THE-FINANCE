/**
 * Test: inventarios/[id] PATCH — cross-tenant item rejection
 *
 * Verifies that a client supplying itemId values that do not belong to the
 * tenant-verified inventario cannot update them (the fix adds `inventarioId`
 * to the inventarioItem.update where clause, so Prisma throws P2025 for
 * items from another tenant).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    inventario: { findFirst: vi.fn() },
    inventarioItem: { update: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(),
  unauthorizedResponse: vi.fn(() => new Response('Unauthorized', { status: 401 })),
}))

import { PATCH } from '../route'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

const mp = prisma as any
const ms = getSession as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PATCH /api/inventarios/[id]', () => {
  it('returns 401 when session is missing', async () => {
    ms.mockResolvedValue(null)
    const req = new Request('http://localhost/api/inventarios/inv-1', {
      method: 'PATCH',
      body: JSON.stringify({ items: [] }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'inv-1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when inventario does not belong to tenant', async () => {
    ms.mockResolvedValue({ user: { tenantId: 'tenant-A' } })
    mp.inventario.findFirst.mockResolvedValue(null)

    const req = new Request('http://localhost/api/inventarios/inv-other', {
      method: 'PATCH',
      body: JSON.stringify({ items: [{ itemId: 'item-1', qtdContada: 5 }] }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'inv-other' }) })
    expect(res.status).toBe(404)
    expect(mp.$transaction).not.toHaveBeenCalled()
  })

  it('passes inventarioId in the where clause so cross-tenant itemIds are rejected', async () => {
    ms.mockResolvedValue({ user: { tenantId: 'tenant-A' } })
    // Tenant-A's inventario found
    mp.inventario.findFirst.mockResolvedValue({ id: 'inv-A', tenantId: 'tenant-A', status: 'ABERTO' })

    // $transaction receives an array of promises — capture the update args
    mp.$transaction.mockImplementation(async (ops: Promise<unknown>[]) => {
      // Resolve all ops (the mocked update returns undefined)
      return Promise.all(ops)
    })
    mp.inventarioItem.update.mockResolvedValue({ id: 'item-1' })

    const req = new Request('http://localhost/api/inventarios/inv-A', {
      method: 'PATCH',
      body: JSON.stringify({ items: [{ itemId: 'item-from-tenant-B', qtdContada: 3 }] }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'inv-A' }) })
    expect(res.status).toBe(200)

    // Confirm that inventarioId is included in where — this is the ownership guard
    expect(mp.inventarioItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ inventarioId: 'inv-A' }),
      })
    )
  })

  it('when inventarioId is in where, Prisma P2025 (record not found) bubbles as 500 for alien itemIds', async () => {
    ms.mockResolvedValue({ user: { tenantId: 'tenant-A' } })
    mp.inventario.findFirst.mockResolvedValue({ id: 'inv-A', tenantId: 'tenant-A', status: 'ABERTO' })

    // Simulate Prisma throwing P2025 because the itemId+inventarioId combo doesn't exist
    const p2025 = Object.assign(new Error('Record not found'), { code: 'P2025' })
    mp.$transaction.mockRejectedValue(p2025)

    const req = new Request('http://localhost/api/inventarios/inv-A', {
      method: 'PATCH',
      body: JSON.stringify({ items: [{ itemId: 'alien-item', qtdContada: 99 }] }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'inv-A' }) })
    // The route catches all errors and returns 500; the alien item is NOT silently updated
    expect(res.status).toBe(500)
  })
})
