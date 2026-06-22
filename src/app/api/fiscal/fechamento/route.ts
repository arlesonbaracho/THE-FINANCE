import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorizedResponse } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { NfStatus } from '@prisma/client'
import { gerarFechamentoFiscal, nomePeriodo } from '@/services/fiscal/fechamento-fiscal.service'

/** Acima disso, o download síncrono vira risco de timeout — peça intervalo menor. */
const TETO_NOTAS = 5000

function podeExportar(role?: string | null) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER'
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  if (!podeExportar(session.user.role))
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const inicioStr = searchParams.get('inicio')
  const fimStr = searchParams.get('fim')
  if (!inicioStr || !fimStr)
    return NextResponse.json({ error: 'Informe início e fim do período.' }, { status: 400 })

  const inicio = new Date(inicioStr)
  const fim = new Date(fimStr)
  if (isNaN(inicio.getTime()) || isNaN(fim.getTime()))
    return NextResponse.json({ error: 'Datas inválidas.' }, { status: 400 })
  if (inicio > fim)
    return NextResponse.json({ error: 'A data inicial deve ser anterior à final.' }, { status: 400 })

  const tenantId = session.user.tenantId
  const where = {
    tenantId,
    dataEmissao: { gte: inicio, lte: fim },
    status: { in: [NfStatus.AUTORIZADA, NfStatus.CAPTURADA, NfStatus.CANCELADA] },
  }

  const total = await prisma.nfProcessada.count({ where })
  if (total === 0)
    return NextResponse.json({ error: 'Nenhuma nota no período.' }, { status: 422 })
  if (total > TETO_NOTAS)
    return NextResponse.json(
      { error: `Período com ${total} notas excede o limite de ${TETO_NOTAS} para download direto. Escolha um intervalo menor.` },
      { status: 422 },
    )

  try {
    const { buffer } = await gerarFechamentoFiscal({ tenantId, inicio, fim })
    const filename = `fechamento-fiscal-${nomePeriodo(inicio, fim)}.zip`
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    })
  } catch (err) {
    console.error('[fiscal-fechamento]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Falha ao gerar o fechamento.' }, { status: 500 })
  }
}
