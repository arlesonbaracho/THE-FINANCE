// src/lib/whatsapp/whatsapp-inbound.service.ts
import { prisma } from '@/lib/prisma'
import { redisConnection } from '@/lib/bullmq'
import { enviarMensagem } from './evolution.service'

export type EvolutionWebhookPayload = {
  event?: string
  instance?: string
  data?: {
    key?: { remoteJid?: string; fromMe?: boolean; id?: string }
    message?: { conversation?: string; extendedTextMessage?: { text?: string } }
    pushName?: string
  }
  [key: string]: unknown
}

function extrairNumero(jid: string): string {
  return '+' + jid.replace('@s.whatsapp.net', '').replace('@c.us', '').replace(/\D/g, '')
}

function extrairTexto(payload: EvolutionWebhookPayload): string | null {
  return (
    payload.data?.message?.conversation ??
    payload.data?.message?.extendedTextMessage?.text ??
    null
  )
}

export async function processarMensagem(payload: EvolutionWebhookPayload): Promise<void> {
  if (payload.data?.key?.fromMe === true) return
  if (payload.event !== 'messages.upsert') return

  const jid = payload.data?.key?.remoteJid
  if (!jid) return

  const numero = extrairNumero(jid)
  const texto = extrairTexto(payload)
  if (!texto) return

  const contato = await prisma.whatsAppContato.findFirst({
    where: { numero, ativo: true },
    select: { tenantId: true, permiteComandos: true },
  })

  if (!contato) return

  const { tenantId } = contato

  if (!contato.permiteComandos) {
    await enviarMensagem(
      numero,
      'Você não tem permissão para enviar comandos. Entre em contato com o administrador do restaurante.',
      tenantId
    )
    return
  }

  const { interpretarComando, processarConfirmacao } = await import('./whatsapp-bot.service')

  const sessionKey = `whatsapp:session:${numero}:${tenantId}`
  const sessionJson = await redisConnection.get(sessionKey)

  const textoUpper = texto.trim().toUpperCase()
  if (sessionJson && (textoUpper === 'SIM' || textoUpper === 'NÃO' || textoUpper === 'NAO')) {
    await processarConfirmacao(tenantId, numero, textoUpper)
  } else {
    await interpretarComando(tenantId, numero, texto)
  }
}
