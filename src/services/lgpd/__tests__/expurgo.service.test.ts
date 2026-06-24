import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/lib/prisma', () => ({ prisma: {
  emailVerificationCode: { deleteMany: vi.fn() },
  passwordResetToken: { deleteMany: vi.fn() },
  userAccessLog: { deleteMany: vi.fn() },
  whatsAppLog: { deleteMany: vi.fn() },
} }))
import { expurgarDadosAntigos } from '../expurgo.service'
import { prisma } from '@/lib/prisma'
const mp = prisma as any
beforeEach(() => {
  vi.clearAllMocks()
  mp.emailVerificationCode.deleteMany.mockResolvedValue({ count: 3 })
  mp.passwordResetToken.deleteMany.mockResolvedValue({ count: 2 })
  mp.userAccessLog.deleteMany.mockResolvedValue({ count: 10 })
  mp.whatsAppLog.deleteMany.mockResolvedValue({ count: 5 })
})

describe('expurgarDadosAntigos', () => {
  it('apaga transitorios expirados e logs alem do corte, retorna contagens', async () => {
    const r = await expurgarDadosAntigos({ retencaoLogsMeses: 12 })
    expect(r).toEqual({ codigosVerificacao: 3, tokensReset: 2, logsAcesso: 10, logsWhatsapp: 5 })

    // transitorios: expiresAt < now
    const codeWhere = mp.emailVerificationCode.deleteMany.mock.calls[0][0].where
    expect(codeWhere.expiresAt.lt).toBeInstanceOf(Date)
    const tokenWhere = mp.passwordResetToken.deleteMany.mock.calls[0][0].where
    expect(tokenWhere.expiresAt.lt).toBeInstanceOf(Date)

    // logs: createdAt < corte (12 meses atras)
    const logWhere = mp.userAccessLog.deleteMany.mock.calls[0][0].where
    const corte: Date = logWhere.createdAt.lt
    expect(corte).toBeInstanceOf(Date)
    const esperado = new Date(); esperado.setMonth(esperado.getMonth() - 12)
    // mesmo ano/mes do corte
    expect(corte.getFullYear()).toBe(esperado.getFullYear())
    expect(corte.getMonth()).toBe(esperado.getMonth())
    const waWhere = mp.whatsAppLog.deleteMany.mock.calls[0][0].where
    expect(waWhere.createdAt.lt).toBeInstanceOf(Date)
  })

  it('respeita a janela configurada (6 meses)', async () => {
    await expurgarDadosAntigos({ retencaoLogsMeses: 6 })
    const corte: Date = mp.userAccessLog.deleteMany.mock.calls[0][0].where.createdAt.lt
    const esperado = new Date(); esperado.setMonth(esperado.getMonth() - 6)
    expect(corte.getMonth()).toBe(esperado.getMonth())
  })
})
