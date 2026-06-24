import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/lib/session', () => ({ getSession: vi.fn(), unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401 }) }))
vi.mock('@/services/lgpd/dados-pessoais.service', () => ({
  contarAdminsAtivos: vi.fn(), anonimizarUsuario: vi.fn(),
  podeAnonimizar: (u: any, n: number) => (u.role === 'ADMIN' ? n > 1 : true),
}))
import { POST } from '../excluir/route'
import { getSession } from '@/lib/session'
import { contarAdminsAtivos, anonimizarUsuario } from '@/services/lgpd/dados-pessoais.service'

beforeEach(() => vi.clearAllMocks())

it('bloqueia o unico admin (409) sem anonimizar', async () => {
  ;(getSession as any).mockResolvedValue({ user: { id: 'u1', tenantId: 't1', role: 'ADMIN' } })
  ;(contarAdminsAtivos as any).mockResolvedValue(1)
  const res = await POST()
  expect(res.status).toBe(409)
  expect(anonimizarUsuario).not.toHaveBeenCalled()
})

it('anonimiza staff (ok)', async () => {
  ;(getSession as any).mockResolvedValue({ user: { id: 'u2', tenantId: 't1', role: 'STAFF' } })
  ;(contarAdminsAtivos as any).mockResolvedValue(1)
  ;(anonimizarUsuario as any).mockResolvedValue(undefined)
  const res = await POST()
  expect(res.status).toBe(200)
  expect(anonimizarUsuario).toHaveBeenCalledWith('u2')
})
