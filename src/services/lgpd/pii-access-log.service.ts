import { prisma } from '@/lib/prisma'

export type AcessoPiiInput = {
  tenantId: string
  userId: string
  acao: 'CONSULTA' | 'EXPORTACAO' | 'EXCLUSAO'
  alvo: string
  detalhe?: string
  ip?: string | null
}

export async function registrarAcessoPii(p: AcessoPiiInput): Promise<void> {
  await prisma.piiAccessLog.create({
    data: {
      tenantId: p.tenantId,
      userId: p.userId,
      acao: p.acao,
      alvo: p.alvo,
      detalhe: p.detalhe,
      ip: p.ip ?? undefined,
    },
  })
}

export async function listarAcessosPii(tenantId: string, opts?: { limit?: number }): Promise<unknown[]> {
  return prisma.piiAccessLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: opts?.limit ?? 100,
  })
}
