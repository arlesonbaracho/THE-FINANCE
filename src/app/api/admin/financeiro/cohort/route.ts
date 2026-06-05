import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import { cohortAnalysis } from '@/services/admin/saas-metrics.service'

export async function GET() {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const data = await cohortAnalysis()
  return NextResponse.json(data)
}
