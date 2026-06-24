import { prisma } from '@/lib/prisma'

export type ResultadoExpurgo = {
  codigosVerificacao: number
  tokensReset: number
  logsAcesso: number
  logsWhatsapp: number
  logsPii: number
}

/**
 * Expurga dados transitórios expirados e logs além da janela de retenção.
 * Platform-wide (manutenção). `retencaoLogsMeses` define o corte dos logs.
 */
export async function expurgarDadosAntigos(
  { retencaoLogsMeses }: { retencaoLogsMeses: number },
): Promise<ResultadoExpurgo> {
  const now = new Date()
  const corte = new Date(now)
  corte.setMonth(corte.getMonth() - retencaoLogsMeses)

  const [codigos, tokens, logsAcesso, logsWa, logsPii] = await Promise.all([
    prisma.emailVerificationCode.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.userAccessLog.deleteMany({ where: { createdAt: { lt: corte } } }),
    prisma.whatsAppLog.deleteMany({ where: { createdAt: { lt: corte } } }),
    prisma.piiAccessLog.deleteMany({ where: { createdAt: { lt: corte } } }),
  ])

  return {
    codigosVerificacao: codigos.count,
    tokensReset: tokens.count,
    logsAcesso: logsAcesso.count,
    logsWhatsapp: logsWa.count,
    logsPii: logsPii.count,
  }
}
