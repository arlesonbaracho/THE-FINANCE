import { prisma } from '@/lib/prisma'
import { enviarResumoDiario } from '@/lib/whatsapp/whatsapp-messages.service'

export async function processDailyReportJob(): Promise<void> {
  const contatos = await prisma.whatsAppContato.findMany({
    where: { ativo: true, recebeResumoDiario: true },
    select: { tenantId: true },
    distinct: ['tenantId'],
  })

  for (const { tenantId } of contatos) {
    try {
      await enviarResumoDiario(tenantId)
      console.log(`[whatsapp-daily-report] Resumo enviado para tenant ${tenantId}`)
    } catch (err) {
      console.error(`[whatsapp-daily-report] Erro tenant ${tenantId}:`, err)
    }
  }
}
