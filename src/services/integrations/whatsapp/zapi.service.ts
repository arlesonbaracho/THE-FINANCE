import { prisma } from '@/lib/prisma'
import { encrypt, decrypt } from '@/lib/crypto'
import { redisConnection } from '@/lib/bullmq'

const BASE = process.env.ZAPI_BASE_URL ?? 'https://api.z-api.io'
const RATE_LIMIT = parseInt(process.env.WHATSAPP_RATE_LIMIT_PER_HOUR ?? '10', 10)

function zapiUrl(instanceId: string, token: string, path: string): string {
  return `${BASE}/instances/${instanceId}/token/${token}${path}`
}

function mascararNumero(numero: string): string {
  const digits = numero.replace(/\D/g, '')
  if (digits.length < 6) return numero
  return numero.slice(0, -8) + ' ****-' + digits.slice(-4)
}

export async function conectar(tenantId: string, instanceId: string, token: string): Promise<void> {
  const res = await fetch(zapiUrl(instanceId, token, '/status'))
  if (!res.ok) {
    throw new Error(`Z-API credenciais inválidas: ${res.status}`)
  }

  await prisma.whatsAppIntegration.upsert({
    where: { tenantId },
    create: {
      tenantId,
      instanceId,
      tokenEncrypted: encrypt(token),
      status: 'DESCONECTADO',
      config: {},
    },
    update: {
      instanceId,
      tokenEncrypted: encrypt(token),
      status: 'DESCONECTADO',
    },
  })
}

export async function verificarStatus(tenantId: string): Promise<{ status: 'CONECTADO' | 'DESCONECTADO' | 'ERRO'; numeroConectado?: string }> {
  const integration = await prisma.whatsAppIntegration.findUniqueOrThrow({ where: { tenantId } })
  const token = decrypt(integration.tokenEncrypted)

  let zapiStatus: { connected?: boolean; phone?: string; error?: string }
  try {
    const res = await fetch(zapiUrl(integration.instanceId, token, '/status'))
    if (!res.ok) {
      await prisma.whatsAppIntegration.update({ where: { tenantId }, data: { status: 'ERRO' } })
      return { status: 'ERRO' }
    }
    zapiStatus = await res.json()
  } catch {
    await prisma.whatsAppIntegration.update({ where: { tenantId }, data: { status: 'ERRO' } })
    return { status: 'ERRO' }
  }

  const connected = zapiStatus?.connected === true
  const newStatus = connected ? 'CONECTADO' : 'DESCONECTADO'
  const numeroConectado = zapiStatus?.phone ?? undefined

  await prisma.whatsAppIntegration.update({
    where: { tenantId },
    data: {
      status: newStatus,
      numeroConectado: connected ? (numeroConectado ?? null) : null,
      ultimaConexao: connected ? new Date() : undefined,
    },
  })

  return { status: newStatus, numeroConectado }
}

export async function getQrCode(tenantId: string): Promise<string | null> {
  const integration = await prisma.whatsAppIntegration.findUnique({ where: { tenantId } })
  if (!integration) return null
  if (integration.status === 'CONECTADO') return null

  const token = decrypt(integration.tokenEncrypted)
  try {
    const res = await fetch(zapiUrl(integration.instanceId, token, '/qr-code'))
    if (!res.ok) return null
    const data = await res.json()
    return data.value ?? data.qrcode ?? null
  } catch {
    return null
  }
}

export async function desconectar(tenantId: string): Promise<void> {
  await prisma.whatsAppIntegration.update({
    where: { tenantId },
    data: {
      tokenEncrypted: '',
      numeroConectado: null,
      status: 'DESCONECTADO',
      ultimaConexao: null,
    },
  })
}

export async function enviarMensagem(
  tenantId: string,
  numero: string,
  mensagem: string,
  tipo: 'ALERTA' | 'RESUMO_DIARIO' | 'PEDIDO_IFOOD' = 'ALERTA'
): Promise<boolean> {
  const rateLimitKey = `wpp:ratelimit:${tenantId}`
  const count = await redisConnection.incr(rateLimitKey)
  if (count === 1) {
    await redisConnection.expire(rateLimitKey, 3600)
  }
  if (count > RATE_LIMIT) {
    console.warn(`[whatsapp] Rate limit atingido para tenant ${tenantId}`)
    return false
  }

  const integration = await prisma.whatsAppIntegration.findUnique({ where: { tenantId } })
  if (!integration || integration.status !== 'CONECTADO') return false

  const token = decrypt(integration.tokenEncrypted)
  let success = false
  let erro: string | undefined

  try {
    const res = await fetch(zapiUrl(integration.instanceId, token, '/send-text'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: numero, message: mensagem }),
    })
    success = res.ok
    if (!res.ok) {
      const txt = await res.text()
      erro = `Z-API ${res.status}: ${txt}`
    }
  } catch (err) {
    erro = (err as Error).message
  }

  await prisma.whatsAppLog.create({
    data: {
      tenantId,
      tipo,
      destinatario: mascararNumero(numero),
      mensagem,
      status: success ? 'ENVIADO' : 'FALHOU',
      erro: erro ?? null,
    },
  })

  return success
}
