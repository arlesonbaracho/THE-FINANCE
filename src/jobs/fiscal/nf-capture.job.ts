import { prisma } from '@/lib/prisma'
import { sincronizarNotasDestinadas } from '@/services/fiscal/nf-capture.service'

export async function processNfCaptureJob(): Promise<void> {
  const fiscais = await prisma.tenantFiscal.findMany({
    where: { focusEmpresaId: { not: null }, certificadoStatus: 'ATIVO' },
    select: { tenantId: true },
  })
  for (const { tenantId } of fiscais) {
    try {
      const n = await sincronizarNotasDestinadas(tenantId)
      console.log(`[nf-capture] tenant ${tenantId}: ${n} nota(s) capturada(s)`)
    } catch (err) {
      console.error(`[nf-capture] erro tenant ${tenantId}:`, err instanceof Error ? err.message : err)
    }
  }
}
