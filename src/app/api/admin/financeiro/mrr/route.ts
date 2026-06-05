import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import { calcularMRR, historicMRR } from '@/services/admin/saas-metrics.service'

export async function GET(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const meses = parseInt(req.nextUrl.searchParams.get('meses') ?? '12', 10)
  const [atual, historico] = await Promise.all([calcularMRR(), historicMRR(meses)])
  return NextResponse.json({ atual, historico })
}
