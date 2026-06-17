import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorizedResponse } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { salvarCertificado } from '@/services/fiscal/certificado.service'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { certificadoBase64, senha } = await req.json()
  if (!certificadoBase64 || !senha) return NextResponse.json({ error: 'Certificado e senha são obrigatórios' }, { status: 400 })

  const tenant = await prisma.tenant.findUnique({ where: { id: session.user.tenantId }, select: { cnpj: true } })
  if (!tenant?.cnpj) return NextResponse.json({ error: 'Cadastre o CNPJ da empresa antes do certificado.' }, { status: 400 })

  try {
    const { validade } = await salvarCertificado(session.user.tenantId, tenant.cnpj, certificadoBase64, senha)
    return NextResponse.json({ ok: true, validade })
  } catch (err) {
    console.error('[fiscal-certificado]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Falha ao registrar o certificado na Receita/Focus.' }, { status: 502 })
  }
}
