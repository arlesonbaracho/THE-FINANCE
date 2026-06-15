import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function getOrCreateStripeCustomer(tenantId: string, email: string, name: string): Promise<string> {
  const existing = await prisma.stripeCustomer.findUnique({ where: { tenantId } })
  if (existing) return existing.stripeCustomerId

  const customer = await stripe.customers.create({ email, name, metadata: { tenantId } })

  await prisma.stripeCustomer.create({
    data: { tenantId, stripeCustomerId: customer.id },
  })
  return customer.id
}

export async function createCheckoutSession(
  tenantId: string,
  priceId: string,
  email: string,
  name: string,
  successUrl: string,
  cancelUrl: string,
): Promise<{ url: string }> {
  const customerId = await getOrCreateStripeCustomer(tenantId, email, name)

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { tenantId },
  })

  return { url: session.url! }
}

export async function cancelSubscription(tenantId: string): Promise<void> {
  const customer = await prisma.stripeCustomer.findUnique({ where: { tenantId } })
  if (!customer?.stripeSubId) return

  await stripe.subscriptions.update(customer.stripeSubId, { cancel_at_period_end: true })

  await prisma.tenantSubscription.update({
    where: { tenantId },
    data: { status: 'CANCELLED' },
  })
}

export async function handleWebhook(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const customerId =
        typeof session.customer === 'string' ? session.customer : session.customer?.id
      if (!customerId) return

      const subId =
        typeof session.subscription === 'string'
          ? session.subscription
          : (session.subscription as Stripe.Subscription | null)?.id ?? null

      const customer = await prisma.stripeCustomer.findFirst({
        where: { stripeCustomerId: customerId },
      })
      if (!customer) return

      if (subId) {
        await prisma.stripeCustomer.update({
          where: { tenantId: customer.tenantId },
          data: { stripeSubId: subId },
        })
      }

      await prisma.tenantSubscription.update({
        where: { tenantId: customer.tenantId },
        data: {
          status: 'ACTIVE',
          startDate: new Date(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      })
      break
    }
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
      if (!customerId) return
      const customer = await prisma.stripeCustomer.findFirst({ where: { stripeCustomerId: customerId } })
      if (!customer) return
      await prisma.tenantSubscription.update({
        where: { tenantId: customer.tenantId },
        data: {
          status: 'ACTIVE',
          startDate: new Date(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      })
      break
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
      if (!customerId) return
      const customer = await prisma.stripeCustomer.findFirst({ where: { stripeCustomerId: customerId } })
      if (!customer) return
      await prisma.tenantSubscription.update({
        where: { tenantId: customer.tenantId },
        data: { status: 'OVERDUE' },
      })
      break
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
      if (!customerId) return
      const customer = await prisma.stripeCustomer.findFirst({ where: { stripeCustomerId: customerId } })
      if (!customer) return
      await prisma.tenantSubscription.update({
        where: { tenantId: customer.tenantId },
        data: { status: 'CANCELLED' },
      })
      break
    }
  }
}

export { stripe }
