import { prisma } from '@/lib/prisma'
import { emitirNfceParaPedido } from '@/services/fiscal/nfce-emissao.service'

export async function processNfceRetryJob(): Promise<void> {
  const pendentes = await prisma.nfProcessada.findMany({
    where: { origem: 'EMISSAO', status: 'REJEITADA', pedidoId: { not: null } },
    select: { pedidoId: true, tenantId: true },
    take: 50,
  })
  for (const { pedidoId, tenantId } of pendentes) {
    if (!pedidoId) continue
    try { await emitirNfceParaPedido(pedidoId, tenantId) }
    catch (err) { console.error('[nfce-retry]', pedidoId, err instanceof Error ? err.message : err) }
  }
}
