import { prisma } from '@/lib/prisma'
import type { AiUsage } from '@prisma/client'

const COST_INPUT_PER_M = 3
const COST_OUTPUT_PER_M = 15

function calcularCusto(tokensInput: number, tokensOutput: number): number {
  return (tokensInput / 1_000_000) * COST_INPUT_PER_M + (tokensOutput / 1_000_000) * COST_OUTPUT_PER_M
}

async function getLimiteForTenant(tenantId: string): Promise<number> {
  const sub = await prisma.tenantSubscription.findUnique({
    where: { tenantId },
    include: { plan: true },
  })
  const isEnterprise = sub?.plan.name?.toLowerCase().includes('enterprise') ?? false
  if (isEnterprise) return parseInt(process.env.AI_DEFAULT_MONTHLY_LIMIT_ENTERPRISE ?? '0')
  return parseInt(process.env.AI_DEFAULT_MONTHLY_LIMIT_PRO ?? '500000')
}

export async function verificarLimite(
  tenantId: string
): Promise<{ permitido: boolean; percentual: number }> {
  const usage = await prisma.aiUsage.findUnique({ where: { tenantId } })
  if (!usage) return { permitido: true, percentual: 0 }
  if (usage.limiteTokens === 0) return { permitido: true, percentual: 0 }

  const totalUsed = usage.tokensInput + usage.tokensOutput
  const percentual = Math.min(Math.round((totalUsed / usage.limiteTokens) * 100), 100)
  return { permitido: totalUsed < usage.limiteTokens, percentual }
}

export async function incrementarUso(
  tenantId: string,
  tokensInput: number,
  tokensOutput: number
): Promise<void> {
  const now = new Date()
  const mes = now.getMonth() + 1
  const ano = now.getFullYear()

  const existing = await prisma.aiUsage.findUnique({ where: { tenantId } })

  if (!existing) {
    const limiteTokens = await getLimiteForTenant(tenantId)
    await prisma.aiUsage.create({
      data: {
        tenantId,
        mes,
        ano,
        tokensInput,
        tokensOutput,
        custoEstimado: calcularCusto(tokensInput, tokensOutput),
        limiteTokens,
      },
    })
    return
  }

  const newInput = existing.tokensInput + tokensInput
  const newOutput = existing.tokensOutput + tokensOutput
  await prisma.aiUsage.update({
    where: { tenantId },
    data: {
      tokensInput: newInput,
      tokensOutput: newOutput,
      custoEstimado: calcularCusto(newInput, newOutput),
    },
  })

  // Verificar e notificar limites de uso de IA via WhatsApp (fire-and-forget)
  _verificarENotificarLimite(tenantId).catch((err) =>
    console.error('[ai-usage] _verificarENotificarLimite failed:', err)
  )
}

async function _verificarENotificarLimite(tenantId: string): Promise<void> {
  const { percentual } = await verificarLimite(tenantId)

  if (percentual !== 80 && percentual !== 100) return

  // Anti-spam: Redis key expires in 24h per threshold
  const { redisConnection } = await import('@/lib/bullmq')
  const key = `wpp:ai-limit:${tenantId}:${percentual}`
  const existing = await redisConnection.get(key)
  if (existing) return

  await redisConnection.set(key, '1', 'EX', 86400)

  import('@/lib/whatsapp/whatsapp-messages.service')
    .then(({ enviarAlertaLimiteIA }) =>
      enviarAlertaLimiteIA(tenantId, percentual as 80 | 100)
    )
    .catch((err) => console.error('[whatsapp] enviarAlertaLimiteIA failed:', err))
}

export async function resetarUsoMensal(): Promise<void> {
  const now = new Date()
  const mes = now.getMonth() + 1
  const ano = now.getFullYear()

  const all = await prisma.aiUsage.findMany()
  if (all.length === 0) return

  await prisma.$transaction([
    prisma.aiUsageHistory.createMany({
      data: all.map((u) => ({
        tenantId: u.tenantId,
        mes: u.mes,
        ano: u.ano,
        tokensInput: u.tokensInput,
        tokensOutput: u.tokensOutput,
        custoEstimado: u.custoEstimado,
      })),
    }),
    prisma.aiUsage.updateMany({
      data: { tokensInput: 0, tokensOutput: 0, custoEstimado: 0, mes, ano },
    }),
  ])
}

export async function buscarUso(tenantId: string): Promise<AiUsage | null> {
  return prisma.aiUsage.findUnique({ where: { tenantId } })
}
