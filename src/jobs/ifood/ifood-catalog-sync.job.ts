import { prisma } from '@/lib/prisma'
import { sincronizarDisponibilidade } from '@/services/integrations/ifood/ifood-catalog.service'

export async function processCatalogSyncJob(): Promise<void> {
  const integracoes = await prisma.iFoodIntegration.findMany({
    where: { status: 'CONECTADO' },
    select: { tenantId: true },
  })

  for (const { tenantId } of integracoes) {
    try {
      await sincronizarDisponibilidade(tenantId)
      console.log(`[ifood-catalog-sync] Tenant ${tenantId} sincronizado`)
    } catch (err) {
      console.error(`[ifood-catalog-sync] Erro tenant ${tenantId}:`, err)
    }
  }
}
