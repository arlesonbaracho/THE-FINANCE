import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    tenantFiscal: { findUnique: vi.fn(), update: vi.fn() },
    nfProcessada: { findUnique: vi.fn(), create: vi.fn() },
  },
}))

import { sincronizarNotasDestinadas } from '../nf-capture.service'
import { prisma } from '@/lib/prisma'

const mp = prisma as any
const fakeProvider = { consultarNotasDestinadas: vi.fn(), baixarXml: vi.fn(), registrarEmitente: vi.fn() }

beforeEach(() => {
  vi.clearAllMocks()
  mp.tenantFiscal.findUnique.mockResolvedValue({ tenantId: 't1', focusEmpresaId: 'e1', ultimaSincronizacaoNf: null, tenant: { cnpj: '11222333000181' } })
  mp.tenantFiscal.update.mockResolvedValue({})
  fakeProvider.baixarXml.mockResolvedValue('<xml/>')
})

describe('sincronizarNotasDestinadas', () => {
  it('cria NfProcessada só para chaves novas (idempotência)', async () => {
    fakeProvider.consultarNotasDestinadas.mockResolvedValue([
      { chaveAcesso: 'A', numero: '1', emitenteNome: 'X', valorTotal: 10, dataEmissao: new Date(), modelo: 'NFe' },
      { chaveAcesso: 'B', numero: '2', emitenteNome: 'Y', valorTotal: 20, dataEmissao: new Date(), modelo: 'NFe' },
    ])
    mp.nfProcessada.findUnique.mockImplementation(({ where }: any) => where.chaveAcesso === 'A' ? { id: 'existing' } : null)
    mp.nfProcessada.create.mockResolvedValue({})

    const n = await sincronizarNotasDestinadas('t1', fakeProvider as any)

    expect(n).toBe(1)
    expect(mp.nfProcessada.create).toHaveBeenCalledTimes(1)
    expect(mp.nfProcessada.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ chaveAcesso: 'B', origem: 'SEFAZ', tipo: 'ENTRADA', status: 'CAPTURADA' }),
    }))
    expect(mp.tenantFiscal.update).toHaveBeenCalled()
  })

  it('não faz nada sem focusEmpresaId', async () => {
    mp.tenantFiscal.findUnique.mockResolvedValue({ tenantId: 't1', focusEmpresaId: null, tenant: { cnpj: '1' } })
    const n = await sincronizarNotasDestinadas('t1', fakeProvider as any)
    expect(n).toBe(0)
    expect(fakeProvider.consultarNotasDestinadas).not.toHaveBeenCalled()
  })
})
