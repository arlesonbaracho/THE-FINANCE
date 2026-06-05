import { prisma } from '@/lib/prisma'
import { parsePlanFeatures } from '@/lib/plan-features'

export class MultiUnitForbiddenError extends Error {
  readonly status = 403
  constructor() {
    super('Funcionalidade Multi-Unidade não disponível no seu plano.')
  }
}

export async function checkMultiUnitFeature(tenantId: string): Promise<void> {
  const sub = await prisma.tenantSubscription.findUnique({
    where: { tenantId },
    include: { plan: true },
  })

  const features = parsePlanFeatures(sub?.plan?.features)
  if (!features.multiUnit) {
    throw new MultiUnitForbiddenError()
  }
}
