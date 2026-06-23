/**
 * Test: convite/[token] POST — LGPD consent records written on invite acceptance
 *
 * Verifies that when a valid invite-acceptance payload (including aceiteLgpd: true)
 * is posted to the route, two ConsentRecord rows are created — one for POLITICA
 * and one for TERMOS — with the correct userId, tenantId, documento, and versao.
 *
 * Approach: user.create + invite.update run inside $transaction([...]) (array form).
 * $transaction is mocked to resolve with [{ id: 'u1' }, {}] so the route can
 * destructure the new user's id. consentRecord.createMany is called separately
 * after the transaction, matching the pattern used in the register flow.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    invite: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    consentRecord: { createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ success: true, remaining: 9, retryAfter: 0 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
}))

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn(async () => 'hashed_password') },
}))

import { NextRequest } from 'next/server'
import { POST } from '../[token]/route'
import { prisma } from '@/lib/prisma'
import { POLITICA_VERSAO, TERMOS_VERSAO } from '@/lib/legal'

const mp = prisma as any

const VALID_INVITE = {
  id: 'invite-1',
  token: 'valid-token-abc123',
  email: 'staff@restaurante.com',
  tenantId: 'tenant-1',
  roleId: 'role-1',
  status: 'PENDING',
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  tenant: { id: 'tenant-1', name: 'Restaurante Teste' },
}

const VALID_BODY = {
  name: 'Maria Costa',
  password: 'Senha1234',
  aceiteLgpd: true,
}

beforeEach(() => {
  vi.clearAllMocks()

  mp.invite.findUnique.mockResolvedValue(VALID_INVITE)
  mp.user.findFirst.mockResolvedValue(null)

  // $transaction resolves with [newUser, updatedInvite]
  mp.$transaction.mockResolvedValue([{ id: 'u1' }, { status: 'ACCEPTED' }])

  mp.consentRecord.createMany.mockResolvedValue({ count: 2 })
})

describe('POST /api/convite/[token] — LGPD consent', () => {
  it('calls consentRecord.createMany with 2 rows (POLITICA + TERMOS) after transaction', async () => {
    const req = new NextRequest('http://localhost/api/convite/valid-token-abc123', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    })

    const res = await POST(req, { params: Promise.resolve({ token: 'valid-token-abc123' }) })

    expect(res.status).toBe(200)

    expect(mp.$transaction).toHaveBeenCalledTimes(1)
    expect(mp.consentRecord.createMany).toHaveBeenCalledTimes(1)

    const { data } = mp.consentRecord.createMany.mock.calls[0][0] as {
      data: Array<{ userId: string; tenantId: string; documento: string; versao: string; ip: string }>
    }

    expect(data).toHaveLength(2)

    const politica = data.find((r) => r.documento === 'POLITICA')
    const termos = data.find((r) => r.documento === 'TERMOS')

    expect(politica).toMatchObject({
      userId: 'u1',
      tenantId: 'tenant-1',
      documento: 'POLITICA',
      versao: POLITICA_VERSAO,
    })

    expect(termos).toMatchObject({
      userId: 'u1',
      tenantId: 'tenant-1',
      documento: 'TERMOS',
      versao: TERMOS_VERSAO,
    })
  })

  it('returns 400 and does NOT call $transaction when aceiteLgpd is missing', async () => {
    const { aceiteLgpd: _, ...bodyWithoutConsent } = VALID_BODY
    const req = new NextRequest('http://localhost/api/convite/valid-token-abc123', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyWithoutConsent),
    })

    const res = await POST(req, { params: Promise.resolve({ token: 'valid-token-abc123' }) })

    expect(res.status).toBe(400)
    expect(mp.$transaction).not.toHaveBeenCalled()
    expect(mp.consentRecord.createMany).not.toHaveBeenCalled()
  })

  it('returns 400 when aceiteLgpd is false', async () => {
    const req = new NextRequest('http://localhost/api/convite/valid-token-abc123', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_BODY, aceiteLgpd: false }),
    })

    const res = await POST(req, { params: Promise.resolve({ token: 'valid-token-abc123' }) })

    expect(res.status).toBe(400)
    expect(mp.consentRecord.createMany).not.toHaveBeenCalled()
  })
})
