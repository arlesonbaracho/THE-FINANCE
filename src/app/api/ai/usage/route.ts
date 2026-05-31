import { NextResponse } from 'next/server'
import { getTenantId, unauthorizedResponse } from '@/lib/session'
import { buscarUso } from '@/services/ai/ai-usage.service'

export async function GET() {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()
  const usage = await buscarUso(tenantId)
  return NextResponse.json(usage ?? { tokensInput: 0, tokensOutput: 0, limiteTokens: 0 })
}
