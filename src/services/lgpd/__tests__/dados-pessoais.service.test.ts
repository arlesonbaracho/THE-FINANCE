import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: vi.fn(), update: vi.fn(), count: vi.fn() }, consentRecord: { findMany: vi.fn() }, userAccessLog: { findMany: vi.fn() } } }))
import { exportarDadosUsuario, anonimizarUsuario, podeAnonimizar } from '../dados-pessoais.service'
import { prisma } from '@/lib/prisma'
const mp = prisma as any
beforeEach(() => vi.clearAllMocks())

describe('podeAnonimizar', () => {
  it('bloqueia o unico ADMIN ativo', () => {
    expect(podeAnonimizar({ role: 'ADMIN', tenantId: 't1' }, 1)).toBe(false)
  })
  it('permite ADMIN quando ha outros admins', () => {
    expect(podeAnonimizar({ role: 'ADMIN', tenantId: 't1' }, 2)).toBe(true)
  })
  it('permite staff/manager', () => {
    expect(podeAnonimizar({ role: 'STAFF', tenantId: 't1' }, 1)).toBe(true)
    expect(podeAnonimizar({ role: 'MANAGER', tenantId: 't1' }, 1)).toBe(true)
  })
})

describe('exportarDadosUsuario', () => {
  it('retorna perfil+consentimentos+logs sem password/pin', async () => {
    mp.user.findUnique.mockResolvedValue({ id: 'u1', name: 'Ana', email: 'a@x.com', role: 'STAFF', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date(), ultimoAcesso: null, avatarUrl: null })
    mp.consentRecord.findMany.mockResolvedValue([{ documento: 'POLITICA', versao: '2026-06-22', aceitoEm: new Date() }])
    mp.userAccessLog.findMany.mockResolvedValue([{ createdAt: new Date() }])
    const r = await exportarDadosUsuario('u1') as any
    expect(r.perfil.id).toBe('u1')
    expect(JSON.stringify(r)).not.toMatch(/password|pin/i)
    expect(r.consentimentos).toHaveLength(1)
    expect(r.logsAcesso).toHaveLength(1)
    // o select do findUnique nao pede password/pin
    const sel = mp.user.findUnique.mock.calls[0][0].select
    expect(sel.password).toBeUndefined()
    expect(sel.pin).toBeUndefined()
  })
})

describe('anonimizarUsuario', () => {
  it('limpa dados pessoais, inativa e seta anonimizadoEm', async () => {
    mp.user.update.mockResolvedValue({})
    await anonimizarUsuario('u1')
    const data = mp.user.update.mock.calls[0][0].data
    expect(mp.user.update.mock.calls[0][0].where).toEqual({ id: 'u1' })
    expect(data.name).toBeNull()
    expect(data.email).toBe('anonimizado+u1@removido.local')
    expect(data.pin).toBeNull()
    expect(data.password).toBeNull()
    expect(data.status).toBe('INACTIVE')
    expect(data.anonimizadoEm).toBeInstanceOf(Date)
  })
})
