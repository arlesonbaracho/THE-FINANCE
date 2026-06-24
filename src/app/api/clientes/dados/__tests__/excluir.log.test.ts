import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/lib/session', () => ({ getSession: vi.fn(), unauthorizedResponse: () => new Response('{}', { status: 401 }) }))
vi.mock('@/services/lgpd/cliente-dados.service', () => ({ excluirDadosCliente: vi.fn() }))
vi.mock('@/services/lgpd/pii-access-log.service', () => ({ registrarAcessoPii: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ getClientIp: () => '1.2.3.4' }))
import { POST } from '../excluir/route'
import { getSession } from '@/lib/session'
import { excluirDadosCliente } from '@/services/lgpd/cliente-dados.service'
import { registrarAcessoPii } from '@/services/lgpd/pii-access-log.service'
beforeEach(() => vi.clearAllMocks())
const req = (b: any) => new Request('http://x', { method: 'POST', body: JSON.stringify(b) }) as any

it('registra EXCLUSAO com userId/tenantId da sessao', async () => {
  ;(getSession as any).mockResolvedValue({ user: { id: 'u1', tenantId: 't1', role: 'ADMIN' } })
  ;(excluirDadosCliente as any).mockResolvedValue({ reservas: 2, contatos: 0, logs: 1 })
  ;(registrarAcessoPii as any).mockResolvedValue(undefined)
  const res = await POST(req({ telefone: '11999998888' }))
  expect(res.status).toBe(200)
  expect(registrarAcessoPii).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 't1', userId: 'u1', acao: 'EXCLUSAO' }))
})

it('nao falha a resposta se o log rejeitar', async () => {
  ;(getSession as any).mockResolvedValue({ user: { id: 'u1', tenantId: 't1', role: 'ADMIN' } })
  ;(excluirDadosCliente as any).mockResolvedValue({ reservas: 0, contatos: 0, logs: 0 })
  ;(registrarAcessoPii as any).mockRejectedValue(new Error('db down'))
  const res = await POST(req({ telefone: '11999998888' }))
  expect(res.status).toBe(200)
})
