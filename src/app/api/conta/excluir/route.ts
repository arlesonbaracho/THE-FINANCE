import { NextResponse } from 'next/server'
import { getSession, unauthorizedResponse } from '@/lib/session'
import { contarAdminsAtivos, anonimizarUsuario, podeAnonimizar } from '@/services/lgpd/dados-pessoais.service'

export async function POST() {
  const session = await getSession()
  if (!session?.user?.id) return unauthorizedResponse()
  const { id, tenantId, role } = session.user
  const totalAdmins = tenantId ? await contarAdminsAtivos(tenantId) : 0
  if (!podeAnonimizar({ role, tenantId }, totalAdmins)) {
    return NextResponse.json(
      { error: 'Você é o único administrador da conta. Transfira a administração ou encerre a conta antes de excluir seu acesso.' },
      { status: 409 },
    )
  }
  await anonimizarUsuario(id)
  return NextResponse.json({ ok: true })
}
