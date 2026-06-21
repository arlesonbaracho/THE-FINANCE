import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    nfProcessada: { findFirst: vi.fn(), upsert: vi.fn() },
    tenantFiscal: { update: vi.fn() },
    pedido: { findFirst: vi.fn() },
  },
}))
vi.mock('../nfce-payload', () => ({ montarPayloadNfce: vi.fn(() => ({ fake: true })) }))

import { emitirNfceParaPedido } from '../nfce-emissao.service'
import { prisma } from '@/lib/prisma'

const mp = prisma as any
const provider = { emitirNfce: vi.fn(), consultarNfce: vi.fn(), cancelarNfce: vi.fn(), registrarEmitente: vi.fn(), consultarNotasDestinadas: vi.fn(), baixarXml: vi.fn() }

beforeEach(() => {
  vi.clearAllMocks()
  mp.pedido.findFirst.mockResolvedValue({
    id: 'p1', tenantId: 't1', total: 30,
    itens: [{ quantidade: 1, precoUnitario: 30, product: { name: 'X', ncm: null, cfop: null, cstCsosn: null, origemMercadoria: null, unidadeTributavel: null } }],
    pagamentos: [{ formaPagamento: 'PIX', valor: 30 }],
    tenant: { cnpj: '11222333000181', fiscal: { serieNfce: 1, proximoNumeroNfce: 7, ncmPadrao: '2106', cfopPadrao: '5102', cstCsosnPadrao: '102', origemMercadoriaPadrao: '0' } },
  })
  mp.nfProcessada.findFirst.mockResolvedValue(null)
  mp.nfProcessada.upsert.mockResolvedValue({ id: 'nf1' })
  mp.tenantFiscal.update.mockResolvedValue({})
  provider.emitirNfce.mockResolvedValue({ status: 'autorizado', chaveAcesso: 'C', danfeUrl: '/d', protocolo: '1' })
})

describe('emitirNfceParaPedido', () => {
  it('emite e grava AUTORIZADA, incrementa a numeração', async () => {
    const r = await emitirNfceParaPedido('p1', 't1', provider as any)
    expect(provider.emitirNfce).toHaveBeenCalled()
    expect(mp.nfProcessada.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { pedidoId: 'p1' },
      create: expect.objectContaining({ origem: 'EMISSAO', tipo: 'SAIDA', status: 'AUTORIZADA' }),
    }))
    expect(mp.tenantFiscal.update).toHaveBeenCalledWith(expect.objectContaining({ data: { proximoNumeroNfce: 8 } }))
    expect(r.status).toBe('AUTORIZADA')
  })

  it('é idempotente: não reemite se já AUTORIZADA', async () => {
    mp.nfProcessada.findFirst.mockResolvedValue({ id: 'nf1', status: 'AUTORIZADA' })
    const r = await emitirNfceParaPedido('p1', 't1', provider as any)
    expect(provider.emitirNfce).not.toHaveBeenCalled()
    expect(r.status).toBe('AUTORIZADA')
  })

  it('grava REJEITADA quando o provider retorna erro', async () => {
    provider.emitirNfce.mockResolvedValue({ status: 'erro', motivo: 'Rejeição' })
    const r = await emitirNfceParaPedido('p1', 't1', provider as any)
    expect(mp.nfProcessada.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ status: 'REJEITADA' }) }))
    expect(r.status).toBe('REJEITADA')
  })
})
