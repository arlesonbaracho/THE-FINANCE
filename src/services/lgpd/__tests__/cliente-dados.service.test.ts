import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/lib/prisma', () => ({ prisma: {
  reserva: { findMany: vi.fn(), deleteMany: vi.fn() },
  whatsAppContato: { findMany: vi.fn(), deleteMany: vi.fn() },
  whatsAppLog: { findMany: vi.fn(), deleteMany: vi.fn() },
} }))
import { normalizarTelefone, buscarDadosCliente, excluirDadosCliente } from '../cliente-dados.service'
import { prisma } from '@/lib/prisma'
const mp = prisma as any
beforeEach(() => vi.clearAllMocks())

describe('normalizarTelefone', () => {
  it('mantem so digitos', () => {
    expect(normalizarTelefone('(11) 99999-8888')).toBe('11999998888')
    expect(normalizarTelefone('+55 11 9 8888-7777')).toBe('5511988887777')
    expect(normalizarTelefone('')).toBe('')
  })
})

describe('buscarDadosCliente', () => {
  it('casa por telefone normalizado nas 3 fontes, ignora outros', async () => {
    mp.reserva.findMany.mockResolvedValue([
      { id: 'r1', clienteNome: 'Ana', contato: '(11) 99999-8888' },
      { id: 'r2', clienteNome: 'Bob', contato: '11 3333-2222' },
    ])
    mp.whatsAppContato.findMany.mockResolvedValue([{ id: 'c1', nome: 'Ana', numero: '5511999998888' }])
    mp.whatsAppLog.findMany.mockResolvedValue([
      { id: 'l1', destinatario: '5511999998888', conteudo: 'oi' },
      { id: 'l2', destinatario: '5511000000000', conteudo: 'x' },
    ])
    const r = await buscarDadosCliente('t1', '99999-8888')
    expect(r.reservas.map((x: any) => x.id)).toEqual(['r1'])
    expect(r.contatosWhatsapp.map((x: any) => x.id)).toEqual(['c1'])
    expect(r.logsWhatsapp.map((x: any) => x.id)).toEqual(['l1'])
    // tenant-scoped
    expect(mp.reserva.findMany.mock.calls[0][0].where).toEqual({ tenantId: 't1' })
  })

  it('telefone curto sem nome retorna vazio (nao casa tudo)', async () => {
    const r = await buscarDadosCliente('t1', '99')
    expect(r).toEqual({ reservas: [], contatosWhatsapp: [], logsWhatsapp: [] })
    expect(mp.reserva.findMany).not.toHaveBeenCalled()
  })
})

describe('excluirDadosCliente', () => {
  it('deleteMany escopado por ids casados + tenantId', async () => {
    mp.reserva.findMany.mockResolvedValue([{ id: 'r1', contato: '11999998888' }])
    mp.whatsAppContato.findMany.mockResolvedValue([{ id: 'c1', numero: '11999998888' }])
    mp.whatsAppLog.findMany.mockResolvedValue([])
    mp.reserva.deleteMany.mockResolvedValue({ count: 1 })
    mp.whatsAppContato.deleteMany.mockResolvedValue({ count: 1 })
    mp.whatsAppLog.deleteMany.mockResolvedValue({ count: 0 })
    const r = await excluirDadosCliente('t1', '11999998888')
    expect(r).toEqual({ reservas: 1, contatos: 1, logs: 0 })
    expect(mp.reserva.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['r1'] }, tenantId: 't1' } })
    expect(mp.whatsAppContato.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['c1'] }, tenantId: 't1' } })
    expect(mp.whatsAppLog.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [] }, tenantId: 't1' } })
  })
})
