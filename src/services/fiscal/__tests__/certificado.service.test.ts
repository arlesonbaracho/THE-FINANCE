import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: { tenantFiscal: { upsert: vi.fn() } } }))

import { salvarCertificado } from '../certificado.service'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'

const mp = prisma as any
const fakeProvider = { registrarEmitente: vi.fn(), consultarNotasDestinadas: vi.fn(), baixarXml: vi.fn() }

beforeEach(() => {
  vi.clearAllMocks()
  process.env.ENCRYPTION_KEY = 'a'.repeat(64)
  fakeProvider.registrarEmitente.mockResolvedValue({ focusEmpresaId: 'e1', validade: new Date('2027-01-01') })
  mp.tenantFiscal.upsert.mockResolvedValue({})
})

describe('salvarCertificado', () => {
  it('cifra o certificado/senha e registra o emitente', async () => {
    await salvarCertificado('t1', '11222333000181', 'BASE64PFX', 'senha123', fakeProvider as any)
    expect(fakeProvider.registrarEmitente).toHaveBeenCalledWith({ cnpj: '11222333000181', certificadoBase64: 'BASE64PFX', senha: 'senha123' })
    const arg = mp.tenantFiscal.upsert.mock.calls[0][0]
    const stored = arg.update
    expect(stored.certificadoCifrado).not.toBe('BASE64PFX')
    expect(decrypt(stored.certificadoCifrado)).toBe('BASE64PFX')
    expect(decrypt(stored.certificadoSenhaCifrada)).toBe('senha123')
    expect(stored.focusEmpresaId).toBe('e1')
    expect(stored.certificadoStatus).toBe('ATIVO')
    expect(arg.where).toEqual({ tenantId: 't1' })
  })
})
