import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import { projecaoReceita } from '@/services/admin/saas-metrics.service'

export async function GET(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const meses = parseInt(req.nextUrl.searchParams.get('meses') ?? '3', 10)
  const data = await projecaoReceita(meses)
  return NextResponse.json(data)
}
