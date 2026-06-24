import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/lib/session', () => ({ getSession: vi.fn(), unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401 }) }))
vi.mock('@/services/lgpd/cliente-dados.service', () => ({ excluirDadosCliente: vi.fn() }))
import { POST } from '../excluir/route'
import { getSession } from '@/lib/session'
import { excluirDadosCliente } from '@/services/lgpd/cliente-dados.service'
beforeEach(() => vi.clearAllMocks())

function reqWith(body: any) {
  return new Request('http://x/api/clientes/dados/excluir', { method: 'POST', body: JSON.stringify(body) }) as any
}

it('403 para nao-admin', async () => {
  ;(getSession as any).mockResolvedValue({ user: { tenantId: 't1', role: 'STAFF' } })
  const res = await POST(reqWith({ telefone: '11999998888' }))
  expect(res.status).toBe(403)
  expect(excluirDadosCliente).not.toHaveBeenCalled()
})

it('200 + contagens para admin', async () => {
  ;(getSession as any).mockResolvedValue({ user: { tenantId: 't1', role: 'ADMIN' } })
  ;(excluirDadosCliente as any).mockResolvedValue({ reservas: 2, contatos: 1, logs: 5 })
  const res = await POST(reqWith({ telefone: '11999998888' }))
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ reservas: 2, contatos: 1, logs: 5 })
  expect(excluirDadosCliente).toHaveBeenCalledWith('t1', '11999998888', undefined)
})
