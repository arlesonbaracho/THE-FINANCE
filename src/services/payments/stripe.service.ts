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

export async function createSetupIntent(
  tenantId: string,
  email: string,
  name: string,
): Promise<{ clientSecret: string }> {
  const customerId = await getOrCreateStripeCustomer(tenantId, email, name)
  const intent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ['card'],
    usage: 'off_session',
  })
  return { clientSecret: intent.client_secret! }
}

export async function createSubscriptionFromPaymentMethod(
  tenantId: string,
  priceId: string,
  paymentMethodId: string,
): Promise<{ status: string }> {
  const customer = await prisma.stripeCustomer.findUnique({ where: { tenantId } })
  if (!customer) throw new Error('Cliente Stripe não encontrado')

  await stripe.paymentMethods.attach(paymentMethodId, { customer: customer.stripeCustomerId })
  await stripe.customers.update(customer.stripeCustomerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  })

  const subscription = await stripe.subscriptions.create({
    customer: customer.stripeCustomerId,
    items: [{ price: priceId }],
    default_payment_method: paymentMethodId,
    metadata: { tenantId },
  })

  await prisma.stripeCustomer.update({
    where: { tenantId },
    data: { stripeSubId: subscription.id },
  })

  return { status: subscription.status }
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
