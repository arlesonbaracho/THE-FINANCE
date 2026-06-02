import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { enviarMensagem } from '@/services/integrations/whatsapp/zapi.service'

function allowed(role?: string | null) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER'
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId || !allowed(session.user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const tenantId = session.user.tenantId

  const integration = await prisma.whatsAppIntegration.findUnique({
    where: { tenantId },
    select: { config: true, numeroConectado: true },
  })

  const config = (integration?.config ?? {}) as { alertas?: { numeros?: string[] } }
  const primeiroNumero = config?.alertas?.numeros?.[0] ?? integration?.numeroConectado

  if (!primeiroNumero) {
    return NextResponse.json({ error: 'Nenhum número configurado. Adicione um número em Alertas críticos.' }, { status: 400 })
  }

  const mensagem = [
    `✅ *THE FINANCE — Mensagem de Teste*`,
    `WhatsApp configurado com sucesso!`,
    `As notificações serão enviadas para este número.`,
  ].join('\n')

  const ok = await enviarMensagem(tenantId, primeiroNumero, mensagem, 'ALERTA')
  return NextResponse.json({ ok })
}
