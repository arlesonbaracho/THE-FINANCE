import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/lib/prisma', () => ({ prisma: { piiAccessLog: { create: vi.fn(), findMany: vi.fn() } } }))
import { registrarAcessoPii, listarAcessosPii } from '../pii-access-log.service'
import { prisma } from '@/lib/prisma'
const mp = prisma as any
beforeEach(() => vi.clearAllMocks())

describe('registrarAcessoPii', () => {
  it('cria o log com os campos', async () => {
    mp.piiAccessLog.create.mockResolvedValue({})
    await registrarAcessoPii({ tenantId: 't1', userId: 'u1', acao: 'EXCLUSAO', alvo: '11999998888', detalhe: '2 reservas', ip: '1.2.3.4' })
    expect(mp.piiAccessLog.create).toHaveBeenCalledWith({
      data: { tenantId: 't1', userId: 'u1', acao: 'EXCLUSAO', alvo: '11999998888', detalhe: '2 reservas', ip: '1.2.3.4' },
    })
  })
})

describe('listarAcessosPii', () => {
  it('lista tenant-scoped, desc, take default 100', async () => {
    mp.piiAccessLog.findMany.mockResolvedValue([{ id: 'a' }])
    const r = await listarAcessosPii('t1')
    expect(r).toEqual([{ id: 'a' }])
    expect(mp.piiAccessLog.findMany).toHaveBeenCalledWith({ where: { tenantId: 't1' }, orderBy: { createdAt: 'desc' }, take: 100 })
  })
})
