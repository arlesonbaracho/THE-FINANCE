import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorizedResponse } from '@/lib/session'
import { prepararImportacao, aplicarEntradaEstoque } from '@/services/fiscal/nf-import.service'
import type { ItemConfirmado } from '@/services/fiscal/nf-import.service'

type Params = { params: { id: string } }

function adminGuard(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session?.user?.tenantId) return unauthorizedResponse()
  if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  return null
}

/** GET /api/fiscal/importar/[id]
 *  Returns the enriched de-para for the confirmation screen.
 *  Admin-only. */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  const guard = adminGuard(session)
  if (guard) return guard

  const tenantId = session!.user!.tenantId as string

  try {
    const result = await prepararImportacao(tenantId, params.id)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao preparar importação'
    console.error('[fiscal-importar GET]', msg)
    const status = msg.includes('sem XML') ? 400 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

interface PostBody {
  itens: ItemConfirmado[]
}

/** POST /api/fiscal/importar/[id]
 *  Body: { itens: [{ insumoId, quantidade, custoUnitario }] }
 *  Applies stock entry + marks NF as CONCLUIDA. Admin-only. */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession()
  const guard = adminGuard(session)
  if (guard) return guard

  const tenantId = session!.user!.tenantId as string
  const userId = (session!.user as { id: string }).id

  const body = (await req.json()) as PostBody

  if (!Array.isArray(body?.itens) || body.itens.length === 0) {
    return NextResponse.json({ error: 'Nenhum item enviado para confirmar' }, { status: 400 })
  }

  const itensValidos = body.itens.filter((i) => i.insumoId && i.quantidade > 0)
  if (itensValidos.length === 0) {
    return NextResponse.json({ error: 'Nenhum item válido (insumoId + quantidade > 0)' }, { status: 400 })
  }

  try {
    const { itensCriados } = await aplicarEntradaEstoque(tenantId, userId, params.id, itensValidos)
    return NextResponse.json({ ok: true, itensCriados })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao aplicar entrada de estoque'
    console.error('[fiscal-importar POST]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
