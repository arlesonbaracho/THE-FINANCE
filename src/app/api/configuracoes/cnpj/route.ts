import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorizedResponse } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { isValidCnpj, normalizeCnpj, formatCnpj, lookupCnpj, buildFiscalData } from '@/services/fiscal/cnpj.service'

export async function GET() {
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN'
  if (!isAdmin) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { cnpj: true },
  })
  return NextResponse.json({ cnpj: tenant?.cnpj ? formatCnpj(tenant.cnpj) : null })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN'
  if (!isAdmin) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { cnpj } = await req.json()
  if (!isValidCnpj(cnpj)) return NextResponse.json({ error: 'CNPJ inválido' }, { status: 400 })
  const digits = normalizeCnpj(cnpj)

  const emUso = await prisma.tenant.findFirst({ where: { cnpj: digits, NOT: { id: session.user.tenantId } } })
  if (emUso) return NextResponse.json({ error: 'CNPJ já cadastrado em outra conta.' }, { status: 400 })

  const lookup = await lookupCnpj(digits)
  if (lookup.status === 'not_found' || lookup.status === 'inactive') {
    return NextResponse.json({ error: 'CNPJ não encontrado ou inativo na Receita Federal.' }, { status: 400 })
  }
  const fiscalData = buildFiscalData(lookup)

  await prisma.tenant.update({
    where: { id: session.user.tenantId },
    data: {
      cnpj: digits,
      fiscal: { upsert: { create: fiscalData, update: fiscalData } },
    },
  })
  return NextResponse.json({ ok: true })
}
