import { prisma } from '@/lib/prisma'
import { verificarLimite } from '@/services/ai/ai-usage.service'

export async function checkAiLimit(
  tenantId: string
): Promise<{ permitido: boolean; percentual: number }> {
  const { permitido, percentual } = await verificarLimite(tenantId)

  if (percentual >= 80) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recent = await prisma.alert.findFirst({
      where: {
        tenantId,
        tipo: 'SISTEMA',
        metadata: { path: ['subtipo'], equals: 'LIMITE_IA_80' },
        criadoEm: { gte: oneDayAgo },
      },
    })
    if (!recent) {
      await prisma.alert.create({
        data: {
          tenantId,
          tipo: 'SISTEMA',
          severidade: 'ALTA',
          titulo: `Uso de IA em ${percentual}% do limite mensal`,
          descricao: `O tenant atingiu ${percentual}% do limite de tokens de IA para este mês.`,
          status: 'NAO_LIDO',
          metadata: { subtipo: 'LIMITE_IA_80', percentual },
        },
      })
    }
  }

  return { permitido, percentual }
}
