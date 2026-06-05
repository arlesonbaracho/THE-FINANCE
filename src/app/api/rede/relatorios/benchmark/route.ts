import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { checkMultiUnitFeature, MultiUnitForbiddenError } from '@/lib/check-multi-unit'
import { benchmarkUnidades } from '@/services/multi-unit/consolidated-reports.service'
import { subDays, startOfDay, endOfDay } from 'date-fns'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try { await checkMultiUnitFeature(session.user.tenantId) }
  catch (e) { if (e instanceof MultiUnitForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 }); throw e }

  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10)
  const fim = endOfDay(new Date())
  const inicio = startOfDay(subDays(fim, days))

  const data = await benchmarkUnidades(session.user.brandId!, { inicio, fim })
  return NextResponse.json(data)
}
