import { describe, it, expect, beforeAll } from 'vitest'
import { signAdminToken, verifyAdminToken, signImpersonationToken, verifyImpersonationToken } from '@/lib/admin-auth'

beforeAll(() => {
  process.env.ADMIN_JWT_SECRET = 'test-secret-at-least-32-characters-long-ok'
})

describe('Admin JWT', () => {
  const payload = { sub: 'admin-123', email: 'admin@test.com', role: 'SUPER_ADMIN' }

  it('signs and verifies a valid admin token', async () => {
    const token = await signAdminToken(payload)
    expect(typeof token).toBe('string')
    expect(token.split('.').length).toBe(3) // valid JWT structure

    const verified = await verifyAdminToken(token)
    expect(verified).not.toBeNull()
    expect(verified?.sub).toBe(payload.sub)
    expect(verified?.email).toBe(payload.email)
    expect(verified?.role).toBe(payload.role)
  })

  it('rejects a tampered token', async () => {
    const token = await signAdminToken(payload)
    const tampered = token.slice(0, -5) + 'XXXXX'
    const result = await verifyAdminToken(tampered)
    expect(result).toBeNull()
  })

  it('rejects a completely invalid string', async () => {
    const result = await verifyAdminToken('not.a.jwt')
    expect(result).toBeNull()
  })

  it('rejects an empty string', async () => {
    const result = await verifyAdminToken('')
    expect(result).toBeNull()
  })
})

describe('Impersonation JWT', () => {
  const payload = { tenantId: 'tenant-abc', tenantName: 'Sabor do Norte', adminId: 'admin-123' }

  it('signs and verifies a valid impersonation token', async () => {
    const token = await signImpersonationToken(payload)
    const verified = await verifyImpersonationToken(token)
    expect(verified).not.toBeNull()
    expect(verified?.tenantId).toBe(payload.tenantId)
    expect(verified?.tenantName).toBe(payload.tenantName)
    expect(verified?.adminId).toBe(payload.adminId)
  })

  it('rejects a tampered impersonation token', async () => {
    const token = await signImpersonationToken(payload)
    const tampered = token.slice(0, -3) + 'ZZZ'
    expect(await verifyImpersonationToken(tampered)).toBeNull()
  })
})
