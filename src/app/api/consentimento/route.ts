import { NextResponse } from 'next/server'
import { getSession, unauthorizedResponse } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { DOCUMENTOS_VIGENTES } from '@/lib/legal'
import { getClientIp } from '@/lib/rate-limit'

export async function POST(req: Request) {
  const session = await getSession()
  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const userId = session.user.id
  const tenantId = session.user.tenantId ?? null
  const ip = getClientIp(req)

  // Load what the user has already accepted
  const aceitas = await prisma.consentRecord.findMany({
    where: { userId },
    select: { documento: true, versao: true },
  })

  // Determine which current-version documents have NOT been accepted yet
  const faltantes = DOCUMENTOS_VIGENTES.filter((vigente) => {
    const maiorAceita = aceitas
      .filter((a) => a.documento === vigente.documento)
      .map((a) => a.versao)
      .sort()
      .at(-1)
    return maiorAceita == null || maiorAceita < vigente.versao
  })

  if (faltantes.length > 0) {
    await prisma.consentRecord.createMany({
      data: faltantes.map((d) => ({
        userId,
        tenantId,
        documento: d.documento,
        versao: d.versao,
        ip,
      })),
      skipDuplicates: true,
    })
  }

  return NextResponse.json({ ok: true })
}
