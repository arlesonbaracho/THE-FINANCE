import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/crypto'
import { FocusNfeAdapter } from './focus-nfe.adapter'
import type { FiscalProvider } from './fiscal-provider.types'

export async function salvarCertificado(
  tenantId: string,
  cnpj: string,
  certificadoBase64: string,
  senha: string,
  provider: FiscalProvider = new FocusNfeAdapter(),
): Promise<{ validade: Date | null }> {
  const { focusEmpresaId, validade } = await provider.registrarEmitente({ cnpj, certificadoBase64, senha })

  const data = {
    certificadoCifrado: encrypt(certificadoBase64),
    certificadoSenhaCifrada: encrypt(senha),
    certificadoValidade: validade,
    certificadoStatus: 'ATIVO',
    focusEmpresaId,
  }
  await prisma.tenantFiscal.upsert({
    where: { tenantId },
    create: { tenantId, ...data },
    update: data,
  })
  return { validade }
}
