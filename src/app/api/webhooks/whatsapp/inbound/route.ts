import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'

function validateSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET ?? ''
  if (!secret) return true
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-webhook-secret') ?? req.headers.get('x-hub-signature-256') ?? ''

  if (!validateSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Fire-and-forget: never block Evolution API — return 200 immediately
  import('@/lib/whatsapp/whatsapp-inbound.service')
    .then(({ processarMensagem }) => processarMensagem(payload as Parameters<typeof processarMensagem>[0]))
    .catch((err) => console.error('[inbound]', err))

  return NextResponse.json({ ok: true })
}
