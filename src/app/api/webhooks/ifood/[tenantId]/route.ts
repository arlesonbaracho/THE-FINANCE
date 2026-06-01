import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/prisma'
import { Queue } from 'bullmq'
import { redisConnectionOptions } from '@/lib/bullmq'
import type { Prisma } from '@prisma/client'

function validateSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.IFOOD_WEBHOOK_SECRET ?? ''
  if (!secret) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  const { tenantId } = params
  const rawBody = await req.text()
  const signature = req.headers.get('x-ifood-signature') ?? ''

  if (!validateSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: Prisma.InputJsonValue
  try {
    payload = JSON.parse(rawBody) as Prisma.InputJsonValue
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const ifoodOrderId =
    typeof payload === 'object' && payload !== null && 'id' in payload
      ? String((payload as Record<string, unknown>).id)
      : 'unknown'

  // Salvar log (fire-and-forget)
  prisma.iFoodWebhookLog.create({
    data: {
      tenantId,
      ifoodOrderId,
      payload,
      status: 'PROCESSADO',
    },
  }).catch((err) => console.error('[webhook-log]', err))

  // Enfileirar processamento assíncrono
  const queue = new Queue('ifood-webhook', { connection: redisConnectionOptions })
  await queue.add('process', { tenantId, payload }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } })

  return NextResponse.json({ ok: true }, { status: 200 })
}
