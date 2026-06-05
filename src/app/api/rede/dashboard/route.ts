import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { checkMultiUnitFeature, MultiUnitForbiddenError } from '@/lib/check-multi-unit'
import { buscarKpisConsolidados } from '@/services/multi-unit/brand.service'
import { subDays, startOfDay, endOfDay } from 'date-fns'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    await checkMultiUnitFeature(session.user.tenantId)
  } catch (e) {
    if (e instanceof MultiUnitForbiddenError) {
      return NextResponse.json({ error: e.message }, { status: 403 })
    }
    throw e
  }

  const brandId = session.user.brandId
  if (!brandId) {
    return NextResponse.json({ error: 'Tenant não pertence a uma rede' }, { status: 400 })
  }

  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10)
  const fim = endOfDay(new Date())
  const inicio = startOfDay(subDays(fim, days))

  const kpis = await buscarKpisConsolidados(brandId, { inicio, fim })
  return NextResponse.json(kpis)
}
