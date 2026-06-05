import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { checkMultiUnitFeature, MultiUnitForbiddenError } from '@/lib/check-multi-unit'
import { listarUnidades, adicionarUnidade } from '@/services/multi-unit/brand.service'

async function guard() {
  const session = await getSession()
  if (!session?.user?.tenantId) return { session: null, error: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }) }
  try {
    await checkMultiUnitFeature(session.user.tenantId)
  } catch (e) {
    if (e instanceof MultiUnitForbiddenError) return { session: null, error: NextResponse.json({ error: e.message }, { status: 403 }) }
    throw e
  }
  return { session, error: null }
}

export async function GET() {
  const { session, error } = await guard()
  if (error) return error

  const unidades = await listarUnidades(session!.user.brandId!)
  return NextResponse.json(unidades)
}

export async function POST(req: NextRequest) {
  const { session, error } = await guard()
  if (error) return error

  const { tenantId } = await req.json()
  if (!tenantId) return NextResponse.json({ error: 'tenantId obrigatório' }, { status: 400 })

  await adicionarUnidade(session!.user.brandId!, tenantId)
  return NextResponse.json({ ok: true })
}
