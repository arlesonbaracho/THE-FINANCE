import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorizedResponse } from '@/lib/session'
import { createSubscriptionFromPaymentMethod } from '@/services/payments/stripe.service'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  const { tenantId } = session.user

  const { priceId, paymentMethodId } = await req.json()
  if (!priceId || !paymentMethodId) {
    return NextResponse.json({ error: 'priceId e paymentMethodId são obrigatórios' }, { status: 400 })
  }

  try {
    const result = await createSubscriptionFromPaymentMethod(tenantId, priceId, paymentMethodId)
    return NextResponse.json(result)
  } catch (err: unknown) {
    console.error('[stripe-subscribe]', err)
    const msg = (err as { message?: string })?.message ?? null
    return NextResponse.json({ error: 'Erro ao criar assinatura', detail: msg }, { status: 500 })
  }
}
