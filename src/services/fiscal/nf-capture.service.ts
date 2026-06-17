import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { FocusNfeAdapter } from './focus-nfe.adapter'
import type { FiscalProvider } from './fiscal-provider.types'

export async function sincronizarNotasDestinadas(
  tenantId: string,
  provider: FiscalProvider = new FocusNfeAdapter(),
): Promise<number> {
  const fiscal = await prisma.tenantFiscal.findUnique({
    where: { tenantId },
    include: { tenant: { select: { cnpj: true } } },
  })
  if (!fiscal?.focusEmpresaId || !fiscal.tenant?.cnpj) return 0

  const notas = await provider.consultarNotasDestinadas({
    cnpj: fiscal.tenant.cnpj,
    desde: fiscal.ultimaSincronizacaoNf ?? undefined,
  })

  let criadas = 0
  for (const nota of notas) {
    const existe = await prisma.nfProcessada.findUnique({ where: { chaveAcesso: nota.chaveAcesso } })
    if (existe) continue
    const xml = await provider.baixarXml(nota.chaveAcesso)
    await prisma.nfProcessada.create({
      data: {
        tenantId,
        origem: 'SEFAZ',
        tipo: 'ENTRADA',
        status: 'CAPTURADA',
        chaveAcesso: nota.chaveAcesso,
        numeroNf: nota.numero,
        fornecedorNome: nota.emitenteNome,
        valorTotal: new Prisma.Decimal(nota.valorTotal),
        dataEmissao: nota.dataEmissao,
        modelo: nota.modelo,
        xml,
        processadoPor: 'sefaz',
      },
    })
    criadas++
  }

  await prisma.tenantFiscal.update({ where: { tenantId }, data: { ultimaSincronizacaoNf: new Date() } })
  return criadas
}
