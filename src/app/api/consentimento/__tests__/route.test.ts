/**
 * Tests: POST /api/consentimento
 *
 * Verifies that the route:
 * 1. Returns 401 when no session exists.
 * 2. Calls createMany with only the missing current-version documents
 *    when the user has an outdated set of consents.
 * 3. Does NOT insert any rows (createMany called with empty array or not at all)
 *    when the user has already accepted all current document versions.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(),
  unauthorizedResponse: vi.fn(() => new Response(JSON.stringify({ error: 'Nao autorizado' }), { status: 401 })),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    consentRecord: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn(() => '127.0.0.1'),
}))

import { POST } from '../route'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { POLITICA_VERSAO, TERMOS_VERSAO } from '@/lib/legal'

const mp = prisma as unknown as {
  consentRecord: {
    findMany: ReturnType<typeof vi.fn>
    createMany: ReturnType<typeof vi.fn>
  }
}
const mockGetSession = getSession as ReturnType<typeof vi.fn>

function makeRequest() {
  return new Request('http://localhost/api/consentimento', { method: 'POST' })
}

beforeEach(() => {
  vi.clearAllMocks()
  mp.consentRecord.createMany.mockResolvedValue({ count: 0 })
})

describe('POST /api/consentimento', () => {
  it('returns 401 when session is null', async () => {
    mockGetSession.mockResolvedValue(null)

    const res = await POST(makeRequest())

    expect(res.status).toBe(401)
    expect(mp.consentRecord.findMany).not.toHaveBeenCalled()
    expect(mp.consentRecord.createMany).not.toHaveBeenCalled()
  })

  it('inserts only the missing documents when user has an outdated POLITICA and no TERMOS', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', tenantId: 't1' } })

    // User accepted an old POLITICA version; has never accepted TERMOS
    mp.consentRecord.findMany.mockResolvedValue([
      { documento: 'POLITICA', versao: '2025-01-01' },
    ])

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)

    expect(mp.consentRecord.createMany).toHaveBeenCalledTimes(1)

    const { data } = mp.consentRecord.createMany.mock.calls[0][0] as {
      data: Array<{ userId: string; tenantId: string | null; documento: string; versao: string; ip: string }>
    }

    expect(data).toHaveLength(2)

    const politicaRow = data.find((r) => r.documento === 'POLITICA')
    const termosRow = data.find((r) => r.documento === 'TERMOS')

    expect(politicaRow).toMatchObject({
      userId: 'u1',
      tenantId: 't1',
      documento: 'POLITICA',
      versao: POLITICA_VERSAO,
      ip: '127.0.0.1',
    })
    expect(termosRow).toMatchObject({
      userId: 'u1',
      tenantId: 't1',
      documento: 'TERMOS',
      versao: TERMOS_VERSAO,
      ip: '127.0.0.1',
    })
  })

  it('does not insert any rows when user already accepted both current versions', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', tenantId: 't1' } })

    // Both documents already at current versions
    mp.consentRecord.findMany.mockResolvedValue([
      { documento: 'POLITICA', versao: POLITICA_VERSAO },
      { documento: 'TERMOS', versao: TERMOS_VERSAO },
    ])

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)

    // createMany should not have been called (no missing documents)
    expect(mp.consentRecord.createMany).not.toHaveBeenCalled()
  })
})
