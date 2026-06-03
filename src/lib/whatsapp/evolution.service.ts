// src/lib/whatsapp/evolution.service.ts
import { redisConnection } from '@/lib/bullmq'

const BASE = process.env.EVOLUTION_API_URL ?? 'http://localhost:8080'
const API_KEY = process.env.EVOLUTION_API_KEY ?? ''
const INSTANCE = process.env.EVOLUTION_INSTANCE ?? 'the-finance'
const RATE_LIMIT = parseInt(process.env.WHATSAPP_RATE_LIMIT_PER_HOUR ?? '10', 10)

export async function enviarMensagem(
  numero: string,
  texto: string,
  tenantId: string
): Promise<boolean> {
  try {
    const rateLimitKey = `whatsapp:ratelimit:${tenantId}`
    const pipeline = redisConnection.pipeline()
    pipeline.incr(rateLimitKey)
    pipeline.expire(rateLimitKey, 3600)
    const results = await pipeline.exec()
    const count = (results?.[0]?.[1] as number) ?? 0
    if (count > RATE_LIMIT) {
      console.warn(`[evolution] Rate limit atingido para tenant ${tenantId}`)
      return false
    }

    const res = await fetch(`${BASE}/message/sendText/${INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: API_KEY },
      body: JSON.stringify({ number: numero, text: texto }),
    })
    return res.status >= 200 && res.status < 300
  } catch (err) {
    console.error('[evolution] enviarMensagem error:', (err as Error).message)
    return false
  }
}

export async function verificarConexao(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/instance/connectionState/${INSTANCE}`, {
      headers: { apikey: API_KEY },
    })
    if (!res.ok) return false
    const data = await res.json() as { instance?: { state?: string } }
    return data?.instance?.state === 'open'
  } catch {
    return false
  }
}
