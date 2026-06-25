import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { checkMultiUnitFeature, MultiUnitForbiddenError } from '@/lib/check-multi-unit'
import { exportarPDF, exportarExcel } from '@/services/multi-unit/purchase-order.service'

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession()
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try { await checkMultiUnitFeature(session.user.tenantId) }
  catch (e) { if (e instanceof MultiUnitForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 }); throw e }

  const formato = req.nextUrl.searchParams.get('formato') ?? 'pdf'

  if (formato === 'excel') {
    const buffer = await exportarExcel(params.id)
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="pedido-${params.id}.xlsx"`,
      },
    })
  }

  const buffer = await exportarPDF(params.id)
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="pedido-${params.id}.pdf"`,
    },
  })
}
