import { NextResponse } from 'next/server'
import { getSession, unauthorizedResponse } from '@/lib/session'
import { exportarDadosUsuario } from '@/services/lgpd/dados-pessoais.service'

export async function GET() {
  const session = await getSession()
  if (!session?.user?.id) return unauthorizedResponse()
  const dados = await exportarDadosUsuario(session.user.id)
  return new NextResponse(JSON.stringify(dados, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="meus-dados.json"',
    },
  })
}
