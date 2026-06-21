import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorizedResponse } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/crypto'

function isAdmin(role?: string | null) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN'
}

export async function GET() {
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  if (!isAdmin(session.user.role))
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const fiscal = await prisma.tenantFiscal.findUnique({
    where: { tenantId: session.user.tenantId },
    select: {
      regimeTributario: true,
      inscricaoEstadual: true,
      cscNfce: true,
      cscIdNfce: true,
      serieNfce: true,
      nfceAutomatica: true,
      ncmPadrao: true,
      cfopPadrao: true,
      cstCsosnPadrao: true,
      origemMercadoriaPadrao: true,
    },
  })

  return NextResponse.json({
    regimeTributario: fiscal?.regimeTributario ?? null,
    inscricaoEstadual: fiscal?.inscricaoEstadual ?? null,
    cscIdNfce: fiscal?.cscIdNfce ?? null,
    serieNfce: fiscal?.serieNfce ?? null,
    nfceAutomatica: fiscal?.nfceAutomatica ?? false,
    ncmPadrao: fiscal?.ncmPadrao ?? null,
    cfopPadrao: fiscal?.cfopPadrao ?? null,
    cstCsosnPadrao: fiscal?.cstCsosnPadrao ?? null,
    origemMercadoriaPadrao: fiscal?.origemMercadoriaPadrao ?? null,
    cscConfigurado: fiscal?.cscNfce != null,
  })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  if (!isAdmin(session.user.role))
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json()
  const {
    regimeTributario,
    inscricaoEstadual,
    cscNfce,
    cscIdNfce,
    serieNfce,
    nfceAutomatica,
    ncmPadrao,
    cfopPadrao,
    cstCsosnPadrao,
    origemMercadoriaPadrao,
  } = body

  const tenantId = session.user.tenantId

  // Coerce numeric fields; ignore invalid values
  const serieNfceInt =
    serieNfce !== undefined && serieNfce !== null
      ? (() => { const n = parseInt(String(serieNfce), 10); return isNaN(n) ? undefined : n })()
      : undefined

  // Build update payload — only include defined fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fields: Record<string, any> = {}
  if (regimeTributario !== undefined) fields.regimeTributario = regimeTributario
  if (inscricaoEstadual !== undefined) fields.inscricaoEstadual = inscricaoEstadual
  if (cscIdNfce !== undefined) fields.cscIdNfce = cscIdNfce
  if (serieNfceInt !== undefined) fields.serieNfce = serieNfceInt
  if (nfceAutomatica !== undefined) fields.nfceAutomatica = Boolean(nfceAutomatica)
  if (ncmPadrao !== undefined) fields.ncmPadrao = ncmPadrao
  if (cfopPadrao !== undefined) fields.cfopPadrao = cfopPadrao
  if (cstCsosnPadrao !== undefined) fields.cstCsosnPadrao = cstCsosnPadrao
  if (origemMercadoriaPadrao !== undefined) fields.origemMercadoriaPadrao = origemMercadoriaPadrao

  // Only encrypt and store CSC if a non-empty value was provided
  if (cscNfce && typeof cscNfce === 'string' && cscNfce.trim().length > 0) {
    fields.cscNfce = encrypt(cscNfce)
  }

  await prisma.tenantFiscal.upsert({
    where: { tenantId },
    create: { tenantId, ...fields },
    update: fields,
  })

  return NextResponse.json({ ok: true })
}
