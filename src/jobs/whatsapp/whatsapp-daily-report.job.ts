import { prisma } from '@/lib/prisma'
import { enviarResumoDiario } from '@/services/integrations/whatsapp/whatsapp-messages.service'

export async function processDailyReportJob(): Promise<void> {
  const integracoes = await prisma.whatsAppIntegration.findMany({
    where: { status: 'CONECTADO' },
    select: { tenantId: true, config: true },
  })

  for (const { tenantId, config } of integracoes) {
    const cfg = config as { resumoDiario?: { ativo?: boolean } }
    if (!cfg?.resumoDiario?.ativo) continue

    try {
      await enviarResumoDiario(tenantId)
      console.log(`[whatsapp-daily-report] Resumo enviado para tenant ${tenantId}`)
    } catch (err) {
      console.error(`[whatsapp-daily-report] Erro tenant ${tenantId}:`, err)
    }
  }
}
