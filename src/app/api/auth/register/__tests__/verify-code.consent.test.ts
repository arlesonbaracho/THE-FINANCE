/**
 * Test: verify-code — LGPD consent records written on account creation
 *
 * Verifies that when a valid registration payload (including aceiteLgpd: true)
 * is posted to the verify-code route, two ConsentRecord rows are created —
 * one for POLITICA and one for TERMOS — with the correct userId, tenantId,
 * documento, and versao values.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    emailVerificationCode: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    user: { findUnique: vi.fn() },
    tenant: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    consentRecord: { createMany: vi.fn() },
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ success: true, remaining: 9, retryAfter: 0 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
}))

vi.mock('@/services/fiscal/cnpj.service', () => ({
  normalizeCnpj: vi.fn((v: string) => v.replace(/\D/g, '')),
  isValidCnpj: vi.fn(() => true),
  lookupCnpj: vi.fn(async () => ({ status: 'active', data: {} })),
  buildFiscalData: vi.fn(() => ({ razaoSocial: 'Restaurante Teste LTDA' })),
}))

vi.mock('@/lib/utils', () => ({
  slugify: vi.fn((v: string) => v.toLowerCase().replace(/\s+/g, '-')),
}))

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn(async () => 'hashed_password') },
}))

import { POST } from '../verify-code/route'
import { prisma } from '@/lib/prisma'
import { POLITICA_VERSAO, TERMOS_VERSAO } from '@/lib/legal'

const mp = prisma as any

const VALID_BODY = {
  restaurantName: 'Restaurante Teste',
  name: 'João Silva',
  email: 'joao@teste.com',
  password: 'Senha1234',
  cnpj: '11222333000181',
  code: '123456',
  aceiteLgpd: true,
}

beforeEach(() => {
  vi.clearAllMocks()

  // Valid, unused verification code record
  mp.emailVerificationCode.findFirst.mockResolvedValue({
    id: 'code-id-1',
    email: VALID_BODY.email,
    code: VALID_BODY.code,
    usedAt: null,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    createdAt: new Date(),
  })

  // Mark code as used — no meaningful return needed
  mp.emailVerificationCode.update.mockResolvedValue({})

  // No existing user or tenant with this email/cnpj/slug
  mp.user.findUnique.mockResolvedValue(null)
  mp.tenant.findUnique.mockResolvedValue(null)

  // Created tenant with nested admin user
  mp.tenant.create.mockResolvedValue({
    id: 't1',
    users: [{ id: 'u1' }],
  })

  // Consent records creation
  mp.consentRecord.createMany.mockResolvedValue({ count: 2 })
})

describe('POST /api/auth/register/verify-code — LGPD consent', () => {
  it('calls consentRecord.createMany with 2 rows (POLITICA + TERMOS) after account creation', async () => {
    const req = new Request('http://localhost/api/auth/register/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    })

    const res = await POST(req)

    expect(res.status).toBe(201)

    expect(mp.consentRecord.createMany).toHaveBeenCalledTimes(1)

    const { data } = mp.consentRecord.createMany.mock.calls[0][0] as {
      data: Array<{ userId: string; tenantId: string; documento: string; versao: string; ip: string }>
    }

    expect(data).toHaveLength(2)

    const politica = data.find((r) => r.documento === 'POLITICA')
    const termos = data.find((r) => r.documento === 'TERMOS')

    expect(politica).toMatchObject({
      userId: 'u1',
      tenantId: 't1',
      documento: 'POLITICA',
      versao: POLITICA_VERSAO,
    })

    expect(termos).toMatchObject({
      userId: 'u1',
      tenantId: 't1',
      documento: 'TERMOS',
      versao: TERMOS_VERSAO,
    })
  })

  it('does NOT call consentRecord.createMany when aceiteLgpd is missing', async () => {
    const { aceiteLgpd: _, ...bodyWithoutConsent } = VALID_BODY
    const req = new Request('http://localhost/api/auth/register/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyWithoutConsent),
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
    expect(mp.consentRecord.createMany).not.toHaveBeenCalled()
  })
})
