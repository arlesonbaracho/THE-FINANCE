import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorizedResponse } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { FocusNfeAdapter } from '@/services/fiscal/focus-nfe.adapter'

function isAdmin(role?: string | null) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN'
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  if (!isAdmin(session.user.role))
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { pedidoId, justificativa } = await req.json()
  if (!pedidoId) return NextResponse.json({ error: 'pedidoId obrigatório' }, { status: 400 })
  if (!justificativa || String(justificativa).length < 15)
    return NextResponse.json({ error: 'Justificativa deve ter ao menos 15 caracteres (SEFAZ)' }, { status: 400 })

  const nf = await prisma.nfProcessada.findFirst({
    where: { pedidoId, tenantId: session.user.tenantId },
  })
  if (!nf) return NextResponse.json({ error: 'NF-e não encontrada' }, { status: 404 })
  if (!nf.refExterna) return NextResponse.json({ error: 'NF-e sem referência externa' }, { status: 409 })

  try {
    const result = await new FocusNfeAdapter().cancelarNfce(nf.refExterna, justificativa)

    await prisma.nfProcessada.update({
      where: { id: nf.id },
      data: { status: 'CANCELADA', motivoRejeicao: justificativa },
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[nfce-cancelar]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Falha ao cancelar NFC-e' }, { status: 502 })
  }
}
